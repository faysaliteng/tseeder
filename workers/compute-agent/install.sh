#!/usr/bin/env bash
# ==============================================================================
# tseeder-agent — VM Installer
# Idempotent: safe to run multiple times on the same machine.
# Supports: Ubuntu 22.04/24.04, Debian 12, RHEL/Rocky/Alma 8+, Fedora 40+, Arch
# Must be run as root.
# ==============================================================================
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Config ────────────────────────────────────────────────────────────────────
SERVICE_USER="tseeder-agent"
INSTALL_DIR="/opt/tseeder-agent"
DATA_DIR="/var/lib/tseeder-agent"
ENV_FILE="/etc/tseeder-agent.env"
SERVICE_NAME="tseeder-agent"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
BUN_BIN="/usr/local/bin/bun"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Root check ────────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "This script must be run as root (sudo ./install.sh)"

# ── OS detection ──────────────────────────────────────────────────────────────
detect_os() {
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_ID_LIKE="${ID_LIKE:-}"
    OS_VERSION="${VERSION_ID:-0}"
  else
    die "Cannot detect OS — /etc/os-release not found."
  fi

  case "$OS_ID" in
    ubuntu|debian)
      PKG_MANAGER="apt-get"
      PKG_UPDATE="apt-get update -qq"
      PKG_INSTALL="apt-get install -y -qq"
      SYS_DEPS="curl git ca-certificates"
      ;;
    rhel|centos|rocky|almalinux|ol)
      PKG_MANAGER="dnf"
      PKG_UPDATE="dnf check-update -q || true"
      PKG_INSTALL="dnf install -y -q"
      SYS_DEPS="curl git ca-certificates"
      ;;
    fedora)
      PKG_MANAGER="dnf"
      PKG_UPDATE="dnf check-update -q || true"
      PKG_INSTALL="dnf install -y -q"
      SYS_DEPS="curl git ca-certificates"
      ;;
    arch)
      PKG_MANAGER="pacman"
      PKG_UPDATE="pacman -Sy --noconfirm"
      PKG_INSTALL="pacman -S --noconfirm --needed"
      SYS_DEPS="curl git"
      ;;
    *)
      # Fallback: attempt apt-get
      if command -v apt-get &>/dev/null; then
        PKG_MANAGER="apt-get"
        PKG_UPDATE="apt-get update -qq"
        PKG_INSTALL="apt-get install -y -qq"
        SYS_DEPS="curl git ca-certificates"
        warn "Unknown OS '${OS_ID}', falling back to apt-get"
      elif command -v dnf &>/dev/null; then
        PKG_MANAGER="dnf"
        PKG_UPDATE="dnf check-update -q || true"
        PKG_INSTALL="dnf install -y -q"
        SYS_DEPS="curl git ca-certificates"
        warn "Unknown OS '${OS_ID}', falling back to dnf"
      else
        die "Unsupported OS: ${OS_ID}. Please install manually."
      fi
      ;;
  esac

  info "Detected OS: ${OS_ID} ${OS_VERSION}"
}

# ── System dependencies ───────────────────────────────────────────────────────
install_system_deps() {
  info "Updating package index…"
  eval "$PKG_UPDATE"

  info "Installing system dependencies: ${SYS_DEPS}"
  eval "$PKG_INSTALL $SYS_DEPS"

  success "System dependencies installed."
}

# ── Bun runtime ───────────────────────────────────────────────────────────────
install_bun() {
  if [[ -x "$BUN_BIN" ]]; then
    local version
    version=$("$BUN_BIN" --version 2>/dev/null || echo "unknown")
    success "Bun already installed: ${version}"
    return
  fi

  info "Installing Bun runtime…"
  # Install into /usr/local so it is accessible system-wide
  export BUN_INSTALL="/usr/local"
  curl -fsSL https://bun.sh/install | BUN_INSTALL="/usr/local" bash

  if [[ ! -x "$BUN_BIN" ]]; then
    die "Bun installation failed — ${BUN_BIN} not found after install."
  fi

  success "Bun installed: $("$BUN_BIN" --version)"
}

# ── Dedicated service user ────────────────────────────────────────────────────
create_service_user() {
  if id "$SERVICE_USER" &>/dev/null; then
    success "User '${SERVICE_USER}' already exists — skipping."
    return
  fi

  info "Creating system user '${SERVICE_USER}'…"
  useradd \
    --system \
    --no-create-home \
    --shell /usr/sbin/nologin \
    --comment "tseeder compute agent" \
    "$SERVICE_USER"

  success "User '${SERVICE_USER}' created."
}

# ── Install agent source ──────────────────────────────────────────────────────
install_agent_source() {
  info "Installing agent source to ${INSTALL_DIR}…"

  mkdir -p "$INSTALL_DIR"

  # Copy source files (idempotent — rsync preferred, fallback to cp)
  if command -v rsync &>/dev/null; then
    rsync -a --delete \
      "${SCRIPT_DIR}/src/" "${INSTALL_DIR}/src/"
    rsync -a \
      "${SCRIPT_DIR}/package.json" \
      "${INSTALL_DIR}/"
    [[ -f "${SCRIPT_DIR}/tsconfig.json" ]] && cp "${SCRIPT_DIR}/tsconfig.json" "${INSTALL_DIR}/"
  else
    cp -r "${SCRIPT_DIR}/src" "${INSTALL_DIR}/"
    cp "${SCRIPT_DIR}/package.json" "${INSTALL_DIR}/"
    cp "${SCRIPT_DIR}/tsconfig.json" "${INSTALL_DIR}/" 2>/dev/null || true
  fi

  # Copy lockfile if present (enables --frozen-lockfile)
  for lockfile in bun.lockb bun.lock; do
    if [[ -f "${SCRIPT_DIR}/${lockfile}" ]]; then
      cp "${SCRIPT_DIR}/${lockfile}" "${INSTALL_DIR}/"
      break
    fi
  done

  # Install npm dependencies
  info "Running bun install in ${INSTALL_DIR}…"
  cd "$INSTALL_DIR"
  if [[ -f bun.lockb ]] || [[ -f bun.lock ]]; then
    "$BUN_BIN" install --frozen-lockfile --production
  else
    "$BUN_BIN" install --production
  fi

  # Fix ownership
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$INSTALL_DIR"

  success "Agent source installed."
}

# ── Data directory ────────────────────────────────────────────────────────────
create_data_dir() {
  info "Creating data directory ${DATA_DIR}…"
  mkdir -p "${DATA_DIR}/downloads"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$DATA_DIR"
  chmod 750 "$DATA_DIR"
  success "Data directory ready."
}

# ── Environment file ──────────────────────────────────────────────────────────
write_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    warn "Environment file ${ENV_FILE} already exists — not overwriting."
    warn "Edit it manually if you need to update secrets."
    return
  fi

  info "Writing environment file template to ${ENV_FILE}…"
  cat > "$ENV_FILE" <<'EOF'
# ==============================================================================
# tseeder-agent — Runtime Environment
# Fill in all placeholder values before starting the service.
# This file is owned by tseeder-agent and readable only by root and that user.
# ==============================================================================

# ── Agent identity ────────────────────────────────────────────────────────────
# Unique name for this agent instance (used in logs and orchestrator registry)
WORKER_ID=agent-vm-1

# HTTP port the agent listens on
PORT=8787

# ── Cloudflare Worker auth ────────────────────────────────────────────────────
# Bearer token that Cloudflare Worker uses to authenticate to this agent
# Must match WORKER_CLUSTER_TOKEN in your Workers API secrets
WORKER_CLUSTER_TOKEN=REPLACE_WITH_32_BYTE_HEX

# Shared HMAC secret for signed callbacks from this agent back to the Worker
# Must match CALLBACK_SIGNING_SECRET in your Workers API secrets
CALLBACK_SIGNING_SECRET=REPLACE_WITH_32_BYTE_HEX

# ── R2 Storage ────────────────────────────────────────────────────────────────
# Cloudflare R2 S3-compatible endpoint
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

# R2 bucket name
R2_BUCKET=rdm-files

# R2 access credentials (generate from Cloudflare Dashboard → R2 → Manage API Tokens)
R2_ACCESS_KEY_ID=REPLACE_ME
R2_SECRET_ACCESS_KEY=REPLACE_ME

# ── Download settings ─────────────────────────────────────────────────────────
# Directory where torrent files are downloaded before uploading to R2
DOWNLOAD_DIR=/var/lib/tseeder-agent/downloads

# Maximum number of concurrent download jobs
MAX_CONCURRENT_JOBS=10

# ── Optional ──────────────────────────────────────────────────────────────────
# Log level: trace | debug | info | warn | error (default: info)
# LOG_LEVEL=info

# Presigned URL TTL in seconds for large uploads (default: 3600)
# PRESIGNED_URL_TTL_SECONDS=3600
EOF

  # Restrict permissions — secrets live here
  chown "root:${SERVICE_USER}" "$ENV_FILE"
  chmod 640 "$ENV_FILE"

  success "Environment file written to ${ENV_FILE}"
}

# ── systemd unit ──────────────────────────────────────────────────────────────
install_systemd_unit() {
  local src_unit="${SCRIPT_DIR}/tseeder-agent.service"

  if [[ -f "$src_unit" ]]; then
    info "Installing systemd unit from ${src_unit}…"
    cp "$src_unit" "$SERVICE_FILE"
  else
    info "Writing systemd unit to ${SERVICE_FILE}…"
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=tseeder Compute Agent
Documentation=https://github.com/your-org/tseeder/blob/main/docs/vm-install.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${BUN_BIN} run ${INSTALL_DIR}/src/index.ts
Restart=on-failure
RestartSec=5s
TimeoutStopSec=30s

# ── Security hardening ────────────────────────────────────────
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
ReadWritePaths=${DATA_DIR}

# ── Resource limits ───────────────────────────────────────────
# Large FD limit: many simultaneous torrent peer connections
LimitNOFILE=65536
LimitNPROC=4096

# ── Logging ───────────────────────────────────────────────────
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF
  fi

  chmod 644 "$SERVICE_FILE"
  success "systemd unit installed at ${SERVICE_FILE}"
}

# ── Enable & start ────────────────────────────────────────────────────────────
enable_service() {
  info "Reloading systemd daemon…"
  systemctl daemon-reload

  info "Enabling ${SERVICE_NAME} to start on boot…"
  systemctl enable "$SERVICE_NAME"

  # Don't auto-start if env file still has placeholder values
  if grep -q "REPLACE_WITH_32_BYTE_HEX\|REPLACE_ME" "$ENV_FILE" 2>/dev/null; then
    warn "Environment file contains placeholder values — NOT starting service."
    warn "Edit ${ENV_FILE}, then run: systemctl start ${SERVICE_NAME}"
    return
  fi

  info "Starting ${SERVICE_NAME}…"
  systemctl start "$SERVICE_NAME"
  sleep 2

  if systemctl is-active --quiet "$SERVICE_NAME"; then
    success "Service is running!"
  else
    warn "Service did not start cleanly. Check logs:"
    warn "  journalctl -u ${SERVICE_NAME} -n 50 --no-pager"
  fi
}

# ── Post-install message ──────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  tseeder-agent installation complete!${NC}"
  echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
  echo ""
  echo "  Next steps:"
  echo ""
  echo "  1. Edit the environment file and fill in all secrets:"
  echo "     ${YELLOW}nano ${ENV_FILE}${NC}"
  echo ""
  echo "  2. Start the service:"
  echo "     ${YELLOW}systemctl start ${SERVICE_NAME}${NC}"
  echo ""
  echo "  3. Verify it is running:"
  echo "     ${YELLOW}systemctl status ${SERVICE_NAME}${NC}"
  echo "     ${YELLOW}curl -H \"Authorization: Bearer \$WORKER_CLUSTER_TOKEN\" \\"
  echo "          http://localhost:8787/health${NC}"
  echo ""
  echo "  4. View live logs:"
  echo "     ${YELLOW}journalctl -u ${SERVICE_NAME} -f${NC}"
  echo ""
  echo "  Full documentation: docs/vm-install.md"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  tseeder-agent VM Installer${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
  echo ""

  detect_os
  install_system_deps
  install_bun
  create_service_user
  install_agent_source
  create_data_dir
  write_env_file
  install_systemd_unit
  enable_service
  print_summary
}

main "$@"
