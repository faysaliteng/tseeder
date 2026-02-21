#!/usr/bin/env bash
# ==============================================================================
# tseeder-agent — VM Update Script
# Pulls latest code from GitHub and restarts the service.
# Must be run as root.
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

REPO_URL="https://github.com/faysaliteng/tseeder.git"
TMP_DIR="/tmp/tseeder-latest"
INSTALL_DIR="/opt/tseeder-agent"
AGENT_SRC="workers/compute-agent"
SERVICE_NAME="tseeder-agent"

[[ $EUID -eq 0 ]] || die "Run as root: sudo ./update.sh"

# ── Clone latest ──────────────────────────────────────────────────────────────
info "Cloning latest code from GitHub…"
rm -rf "$TMP_DIR"
git clone --depth 1 "$REPO_URL" "$TMP_DIR"

[[ -d "${TMP_DIR}/${AGENT_SRC}/src" ]] || die "Agent source not found in repo."

# ── Stop service ──────────────────────────────────────────────────────────────
info "Stopping ${SERVICE_NAME}…"
systemctl stop "$SERVICE_NAME" 2>/dev/null || true

# ── Sync source files ─────────────────────────────────────────────────────────
info "Syncing source files to ${INSTALL_DIR}…"
mkdir -p "${INSTALL_DIR}/src/routes"

cp "${TMP_DIR}/${AGENT_SRC}/src/"*.ts        "${INSTALL_DIR}/src/"
cp "${TMP_DIR}/${AGENT_SRC}/src/routes/"*.ts "${INSTALL_DIR}/src/routes/"
cp "${TMP_DIR}/${AGENT_SRC}/package.json"    "${INSTALL_DIR}/"
cp "${TMP_DIR}/${AGENT_SRC}/update.sh"      "${INSTALL_DIR}/" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/update.sh"

# ── Install dependencies ─────────────────────────────────────────────────────
info "Installing dependencies…"
cd "$INSTALL_DIR"
npm install 2>/dev/null || npm install
# tsx must be available locally for the systemd service
npm ls tsx &>/dev/null || npm install tsx

# ── Fix ownership ─────────────────────────────────────────────────────────────
chown -R tseeder-agent:tseeder-agent "$INSTALL_DIR"

# ── Start service ─────────────────────────────────────────────────────────────
info "Starting ${SERVICE_NAME}…"
systemctl start "$SERVICE_NAME"
sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
  success "Service is running!"
else
  warn "Service didn't start. Check: journalctl -u ${SERVICE_NAME} -n 30 --no-pager"
fi

# ── Cleanup ───────────────────────────────────────────────────────────────────
rm -rf "$TMP_DIR"
success "Update complete!"
