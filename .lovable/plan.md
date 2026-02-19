
## Add VM Installation Support for the Compute Agent

### What is being requested

The compute agent currently only ships with Kubernetes (K8s) deployment instructions and a Dockerfile. The request is to add first-class support for running the agent on **any virtual machine** — bare Ubuntu/Debian/RHEL, cloud VMs (AWS EC2, GCP Compute Engine, Azure VM, Hetzner, DigitalOcean Droplets, etc.) — as a `systemd` service, without Docker or Kubernetes. New files and docs only. No existing code changes.

---

### What already exists

| File | Purpose |
|---|---|
| `workers/compute-agent/Dockerfile` | Docker image definition |
| `workers/compute-agent/src/index.ts` | HTTP entrypoint (Node/Bun) |
| `DEPLOYMENT.md` | K8s + Docker deployment runbook |
| `INSTRUCTIONS.md` | Detailed production ops guide (K8s-centric) |
| `docs/runbooks.md` | Incident response |

The agent itself is pure Bun/Node.js with no platform-specific dependencies — it already runs fine on a plain VM, it just lacks the installation tooling and documentation.

---

### Files to create

**1. `workers/compute-agent/install.sh`**
A single idempotent shell script that:
- Detects OS (Ubuntu/Debian/RHEL/Rocky/Fedora/Arch)
- Installs Bun (if not present) via the official Bun installer
- Installs system dependencies: `curl`, `git`, `libtorrent` headers if needed
- Creates a dedicated `tseeder-agent` system user (no login shell, no home)
- Copies agent source to `/opt/tseeder-agent/`
- Runs `bun install --frozen-lockfile`
- Writes `/etc/tseeder-agent.env` (env file template with placeholders — operator fills in)
- Installs and enables the `systemd` unit
- Runs `systemctl daemon-reload && systemctl enable --now tseeder-agent`
- Prints post-install instructions

**2. `workers/compute-agent/tseeder-agent.service`**
A production-hardened `systemd` unit file:
- `Type=simple`
- `User=tseeder-agent` (dedicated low-privilege user)
- `EnvironmentFile=/etc/tseeder-agent.env`
- `ExecStart=/usr/local/bin/bun run /opt/tseeder-agent/src/index.ts`
- `Restart=on-failure`, `RestartSec=5s`
- Security hardening: `NoNewPrivileges=yes`, `ProtectSystem=strict`, `PrivateTmp=yes`, `ReadWritePaths=/var/lib/tseeder-agent`
- `LimitNOFILE=65536` (large file descriptor limit for many simultaneous torrent connections)
- `StandardOutput=journal`, `StandardError=journal`

**3. `workers/compute-agent/.env.example`**
Complete environment variable template for VM deployments:
```
PORT=8787
WORKER_ID=agent-vm-1
WORKER_CLUSTER_TOKEN=
CALLBACK_SIGNING_SECRET=
R2_ENDPOINT=
R2_BUCKET=rdm-files
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
DOWNLOAD_DIR=/var/lib/tseeder-agent/downloads
MAX_CONCURRENT_JOBS=10
```

**4. `docs/vm-install.md`**
Comprehensive, operator-facing VM installation guide covering:
- **Supported platforms**: Ubuntu 22.04/24.04, Debian 12, RHEL/Rocky/Alma 8+, Fedora 40+
- **Supported cloud providers**: AWS EC2, GCP Compute Engine, Azure VM, Hetzner Cloud, DigitalOcean Droplets, Vultr, OVH, Linode/Akamai, bare metal
- **Minimum specs**: 2 vCPU, 4 GB RAM, 100 GB disk (SSD recommended)
- **Recommended specs**: 4 vCPU, 8 GB RAM, 500 GB disk
- **Step-by-step quick-start** (5 commands from zero to running)
- **Manual install** (for operators who don't want to run a curl|bash script)
- **Environment variable reference** (every variable, description, example)
- **Firewall rules** (inbound TCP 8787 from Cloudflare Worker IPs only; no public internet exposure)
- **systemd management commands**: start/stop/restart/status/logs
- **Log viewing**: `journalctl -u tseeder-agent -f`
- **Multiple agents on one VM**: running multiple instances with different `WORKER_ID` and `PORT`
- **Updating the agent**: `git pull` + `bun install` + `systemctl restart`
- **Security hardening checklist**: ufw rules, fail2ban, dedicated user, no root execution
- **Health check verification**: `curl` command to verify the agent reports `available`
- **Troubleshooting table**: common errors and fixes
- **Uninstall instructions**

---

### Technical Details

**Why `systemd` and not Docker on VM?**
Many operators run VMs (especially budget VMs on Hetzner/OVH) where they prefer not to run Docker for simplicity. `systemd` provides process supervision, automatic restart, log management via `journald`, and security sandboxing natively. The agent binary (Bun runtime) is self-contained enough to not need containerisation.

**Security posture for VM deployment:**
- Agent runs as `tseeder-agent` user, not root
- `systemd` unit uses `NoNewPrivileges=yes`, `ProtectSystem=strict`, `PrivateTmp=yes`
- `/etc/tseeder-agent.env` is mode `600`, owned by `tseeder-agent`
- Download directory: `/var/lib/tseeder-agent/downloads` (writable only by service user)
- No inbound ports should be publicly exposed — agent should sit behind a Cloudflare Tunnel or private network, with Cloudflare Worker calling it via `WORKER_CLUSTER_URL`

**No changes to existing files.** All additions are new files:

```
workers/compute-agent/
  install.sh                   ← NEW: idempotent VM install script
  tseeder-agent.service        ← NEW: systemd unit file
  .env.example                 ← NEW: env var template for VM
docs/
  vm-install.md                ← NEW: full VM installation guide
```

**Existing `DEPLOYMENT.md` and `INSTRUCTIONS.md` are left untouched.** The new `docs/vm-install.md` is a standalone document that operators can follow independently of the K8s path.
