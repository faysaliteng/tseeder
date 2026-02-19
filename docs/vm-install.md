# VM Installation Guide — tseeder Compute Agent

Run the tseeder compute agent on any virtual machine or bare-metal server as a
`systemd` service — no Docker, no Kubernetes required.

---

## Table of Contents

1. [Supported Platforms](#supported-platforms)
2. [Hardware Requirements](#hardware-requirements)
3. [Quick Start (5 commands)](#quick-start)
4. [Manual Installation](#manual-installation)
5. [Environment Variable Reference](#environment-variable-reference)
6. [Firewall Configuration](#firewall-configuration)
7. [Service Management](#service-management)
8. [Log Viewing](#log-viewing)
9. [Multiple Agents on One VM](#multiple-agents-on-one-vm)
10. [Updating the Agent](#updating-the-agent)
11. [Security Hardening Checklist](#security-hardening-checklist)
12. [Health Check Verification](#health-check-verification)
13. [Troubleshooting](#troubleshooting)
14. [Uninstall](#uninstall)

---

## Supported Platforms

### Linux distributions

| Distribution | Versions |
|---|---|
| Ubuntu | 22.04 LTS, 24.04 LTS |
| Debian | 12 (Bookworm) |
| RHEL / Rocky Linux / AlmaLinux | 8, 9 |
| Fedora | 40+ |
| Arch Linux | rolling |

> Other `systemd`-based distros will likely work. The install script falls back
> to `apt-get` or `dnf` based on what is available.

### Cloud providers

The agent runs on any cloud VM with Linux:

| Provider | Instance type examples |
|---|---|
| **AWS EC2** | t3.medium, c6i.xlarge, r6i.2xlarge |
| **GCP Compute Engine** | e2-standard-2, n2-standard-4 |
| **Azure Virtual Machines** | Standard_B2s, Standard_D4s_v5 |
| **Hetzner Cloud** | CX22, CPX31, CCX23 |
| **DigitalOcean Droplets** | s-2vcpu-4gb, s-4vcpu-8gb |
| **Vultr** | VC2-2C-4GB, VC2-4C-8GB |
| **OVHcloud** | B2-7, B2-15 |
| **Linode / Akamai** | Linode 4GB, Linode 8GB |
| **Bare metal** | Any server with ≥2 cores and 4 GB RAM |

---

## Hardware Requirements

| | Minimum | Recommended |
|---|---|---|
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 100 GB (SSD) | 500 GB NVMe SSD |
| **Network** | 100 Mbps | 1 Gbps+ |
| **OS** | 64-bit Linux with systemd | same |

> **Disk note:** Downloads are staged locally before upload to R2. Size the disk
> for `MAX_CONCURRENT_JOBS × average torrent size`.

---

## Quick Start

Five commands from a fresh VM to a running agent:

```bash
# 1. Clone the repository (or copy the workers/compute-agent directory)
git clone https://github.com/your-org/tseeder.git
cd tseeder/workers/compute-agent

# 2. Run the installer (requires root)
sudo bash install.sh

# 3. Fill in your secrets
sudo nano /etc/tseeder-agent.env

# 4. Start the service
sudo systemctl start tseeder-agent

# 5. Verify it is healthy
curl -H "Authorization: Bearer $WORKER_CLUSTER_TOKEN" http://localhost:8787/health
```

Expected health response:
```json
{"status":"available","workerId":"agent-vm-1","activeJobs":0,"maxJobs":10}
```

---

## Manual Installation

For operators who prefer not to run a `curl | bash` style script.

### 1. Install system dependencies

**Ubuntu / Debian:**
```bash
sudo apt-get update
sudo apt-get install -y curl git ca-certificates
```

**RHEL / Rocky / Alma:**
```bash
sudo dnf install -y curl git ca-certificates
```

**Fedora:**
```bash
sudo dnf install -y curl git
```

### 2. Install Bun

```bash
# Install system-wide to /usr/local
export BUN_INSTALL=/usr/local
curl -fsSL https://bun.sh/install | bash -s -- --no-interactive

# Verify
bun --version
```

### 3. Create a dedicated service user

```bash
sudo useradd \
  --system \
  --no-create-home \
  --shell /usr/sbin/nologin \
  --comment "tseeder compute agent" \
  tseeder-agent
```

### 4. Copy agent source

```bash
sudo mkdir -p /opt/tseeder-agent
sudo rsync -a workers/compute-agent/src   /opt/tseeder-agent/
sudo rsync -a workers/compute-agent/package.json \
             workers/compute-agent/tsconfig.json \
             workers/compute-agent/bun.lockb \
             /opt/tseeder-agent/ 2>/dev/null || true
```

### 5. Install npm dependencies

```bash
cd /opt/tseeder-agent
sudo -u tseeder-agent /usr/local/bin/bun install --frozen-lockfile --production
sudo chown -R tseeder-agent:tseeder-agent /opt/tseeder-agent
```

### 6. Create the data directory

```bash
sudo mkdir -p /var/lib/tseeder-agent/downloads
sudo chown -R tseeder-agent:tseeder-agent /var/lib/tseeder-agent
sudo chmod 750 /var/lib/tseeder-agent
```

### 7. Write the environment file

```bash
sudo cp workers/compute-agent/.env.example /etc/tseeder-agent.env
sudo chown root:tseeder-agent /etc/tseeder-agent.env
sudo chmod 640 /etc/tseeder-agent.env
sudo nano /etc/tseeder-agent.env   # fill in all secrets
```

### 8. Install the systemd unit

```bash
sudo cp workers/compute-agent/tseeder-agent.service \
        /etc/systemd/system/tseeder-agent.service
sudo chmod 644 /etc/systemd/system/tseeder-agent.service
```

### 9. Enable and start

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tseeder-agent
sudo systemctl status tseeder-agent
```

---

## Environment Variable Reference

All variables are set in `/etc/tseeder-agent.env`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `WORKER_ID` | ✅ | — | Unique agent name. Use descriptive names like `agent-hetzner-1`. Appears in logs and orchestrator. |
| `PORT` | ✅ | `8787` | TCP port the HTTP server listens on. Change per instance for multi-agent setups. |
| `WORKER_CLUSTER_TOKEN` | ✅ | — | Bearer token the Cloudflare Worker sends. Must match `WORKER_CLUSTER_TOKEN` in Workers API secrets. Generate: `openssl rand -hex 32` |
| `CALLBACK_SIGNING_SECRET` | ✅ | — | HMAC key for signing callbacks sent back to Cloudflare. Must match `CALLBACK_SIGNING_SECRET` in Workers secrets. Generate: `openssl rand -hex 32` |
| `R2_ENDPOINT` | ✅ | — | R2 S3-compatible URL: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | ✅ | `rdm-files` | R2 bucket name. Must match the Workers API config. |
| `R2_ACCESS_KEY_ID` | ✅ | — | R2 API token Access Key ID. Create from Cloudflare Dashboard → R2 → Manage R2 API Tokens. |
| `R2_SECRET_ACCESS_KEY` | ✅ | — | R2 API token Secret Access Key. |
| `DOWNLOAD_DIR` | ✅ | `/var/lib/tseeder-agent/downloads` | Local staging directory for downloads. Must be writable by `tseeder-agent`. |
| `MAX_CONCURRENT_JOBS` | ✅ | `10` | Number of simultaneous download jobs. Tune based on CPU, RAM, and disk I/O. |
| `LOG_LEVEL` | ❌ | `info` | Log verbosity: `trace`, `debug`, `info`, `warn`, `error`. |
| `PRESIGNED_URL_TTL_SECONDS` | ❌ | `3600` | Validity of presigned R2 upload URLs. Increase for files >50 GB on slow links. |

---

## Firewall Configuration

> **Important:** The agent port should **never** be exposed to the public internet.
> The Cloudflare Worker contacts agents over a private network or Cloudflare Tunnel.

### Recommended architecture

```
Internet → Cloudflare Worker (public) → Cloudflare Tunnel / VPN → Agent VM (private)
```

### UFW rules (Ubuntu / Debian)

```bash
# Install ufw if not present
sudo apt-get install -y ufw

# Default deny inbound
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if you use a non-standard port)
sudo ufw allow 22/tcp

# Allow agent port ONLY from your Cloudflare Tunnel or orchestrator IP
# Replace 10.0.0.0/8 with your private network CIDR or Cloudflare Tunnel IP
sudo ufw allow from 10.0.0.0/8 to any port 8787 proto tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

### firewalld rules (RHEL / Rocky / Fedora)

```bash
# Allow agent port only from private network
sudo firewall-cmd --permanent \
  --add-rich-rule='rule family="ipv4" source address="10.0.0.0/8" port protocol="tcp" port="8787" accept'

sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

### Cloudflare Tunnel (recommended for public clouds)

The cleanest security posture: use a Cloudflare Tunnel so the agent VM needs no
inbound firewall ports at all — the tunnel connects outbound.

```bash
# Install cloudflared on the agent VM
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg

# Follow: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/
```

---

## Service Management

```bash
# Start the agent
sudo systemctl start tseeder-agent

# Stop the agent
sudo systemctl stop tseeder-agent

# Restart the agent (e.g. after config changes)
sudo systemctl restart tseeder-agent

# Reload environment file without full restart (if supported)
sudo systemctl reload tseeder-agent 2>/dev/null || sudo systemctl restart tseeder-agent

# Check current status
sudo systemctl status tseeder-agent

# Enable auto-start on boot
sudo systemctl enable tseeder-agent

# Disable auto-start on boot
sudo systemctl disable tseeder-agent

# Check if the service is active
systemctl is-active tseeder-agent
```

---

## Log Viewing

The agent logs to `journald`. Standard commands:

```bash
# Follow live logs
journalctl -u tseeder-agent -f

# Last 100 lines
journalctl -u tseeder-agent -n 100 --no-pager

# Logs since a point in time
journalctl -u tseeder-agent --since "2024-01-15 10:00:00"

# Filter by log level (the agent uses structured JSON logging)
journalctl -u tseeder-agent -f | grep '"level":"error"'

# Export logs to a file
journalctl -u tseeder-agent --since "1 hour ago" > /tmp/agent-logs.txt
```

---

## Multiple Agents on One VM

Run multiple agent instances on a single VM by creating separate systemd units
with different `WORKER_ID` and `PORT` values.

### Setup for a second instance

```bash
# 1. Create a second env file
sudo cp /etc/tseeder-agent.env /etc/tseeder-agent-2.env
sudo nano /etc/tseeder-agent-2.env
# Set: WORKER_ID=agent-vm-2  and  PORT=8788

# 2. Create a data directory for instance 2
sudo mkdir -p /var/lib/tseeder-agent-2/downloads
sudo chown -R tseeder-agent:tseeder-agent /var/lib/tseeder-agent-2

# 3. Create a second systemd unit
sudo cp /etc/systemd/system/tseeder-agent.service \
        /etc/systemd/system/tseeder-agent-2.service

# Edit the new unit:
sudo nano /etc/systemd/system/tseeder-agent-2.service
# Change:
#   EnvironmentFile=/etc/tseeder-agent-2.env
#   ReadWritePaths=/var/lib/tseeder-agent-2
#   SyslogIdentifier=tseeder-agent-2

# 4. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now tseeder-agent-2
```

### Verify both instances

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/health
curl -H "Authorization: Bearer $TOKEN" http://localhost:8788/health
```

---

## Updating the Agent

```bash
# 1. Pull latest code
cd /path/to/tseeder
git pull origin main

# 2. Copy updated source
sudo rsync -a workers/compute-agent/src/ /opt/tseeder-agent/src/
sudo rsync -a workers/compute-agent/package.json \
             workers/compute-agent/bun.lockb \
             /opt/tseeder-agent/ 2>/dev/null || true

# 3. Update dependencies
cd /opt/tseeder-agent
sudo -u tseeder-agent /usr/local/bin/bun install --frozen-lockfile --production
sudo chown -R tseeder-agent:tseeder-agent /opt/tseeder-agent

# 4. Restart the service
sudo systemctl restart tseeder-agent

# 5. Verify
sudo systemctl status tseeder-agent
journalctl -u tseeder-agent -n 20 --no-pager
```

---

## Security Hardening Checklist

- [ ] Agent runs as `tseeder-agent` user — **not root**
- [ ] `systemd` unit has `NoNewPrivileges=yes`
- [ ] `systemd` unit has `ProtectSystem=strict`
- [ ] `systemd` unit has `PrivateTmp=yes`
- [ ] `/etc/tseeder-agent.env` is mode `640` (`root:tseeder-agent`)
- [ ] Port 8787 is NOT accessible from the public internet
- [ ] Firewall (ufw / firewalld) allows port 8787 only from trusted CIDRs
- [ ] SSH is on a non-standard port or uses key-only auth
- [ ] `fail2ban` is installed and monitoring SSH
- [ ] Cloudflare Tunnel is used instead of direct port exposure (recommended)
- [ ] OS is kept up to date (`unattended-upgrades` / `dnf-automatic`)
- [ ] `WORKER_CLUSTER_TOKEN` and `CALLBACK_SIGNING_SECRET` are ≥32 random bytes
- [ ] R2 API token has minimal permissions (Object Read + Write on the target bucket only)

### Install fail2ban (Ubuntu / Debian)

```bash
sudo apt-get install -y fail2ban
sudo systemctl enable --now fail2ban
```

### Enable unattended security updates (Ubuntu)

```bash
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Health Check Verification

The agent exposes a `/health` endpoint that requires a valid Bearer token.

```bash
# Set your token in the shell (from /etc/tseeder-agent.env)
export WORKER_CLUSTER_TOKEN="your-token-here"

# Check health
curl -s \
  -H "Authorization: Bearer $WORKER_CLUSTER_TOKEN" \
  http://localhost:8787/health | jq .
```

Expected response when healthy:
```json
{
  "status": "available",
  "workerId": "agent-vm-1",
  "activeJobs": 0,
  "maxJobs": 10
}
```

A `"status": "available"` response means the agent is ready to accept jobs.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Service fails to start: `EnvironmentFile not found` | `/etc/tseeder-agent.env` missing | Copy from `.env.example` and fill in values |
| `401 Unauthorized` on health check | Wrong `WORKER_CLUSTER_TOKEN` in curl or env file | Ensure the token in `Authorization: Bearer <TOKEN>` matches `WORKER_CLUSTER_TOKEN` |
| `403 Forbidden` from Cloudflare Worker | `WORKER_CLUSTER_TOKEN` mismatch between agent and Worker | Verify both sides use the same token |
| Service keeps restarting | Bun crash / missing env var | Run `journalctl -u tseeder-agent -n 50` to see the error |
| `ENOSPC` / disk full errors | Download directory full | Increase disk, or lower `MAX_CONCURRENT_JOBS`. Clean: `rm -rf /var/lib/tseeder-agent/downloads/*` |
| `EMFILE: too many open files` | FD limit too low | Confirm `LimitNOFILE=65536` is in the service unit; restart service |
| Bun not found: `ExecStart` fails | Bun installed in wrong path | `which bun` — update `ExecStart` path in the unit file |
| R2 upload errors: `InvalidAccessKeyId` | Wrong R2 credentials | Update `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` in env file, restart |
| R2 upload errors: `NoSuchBucket` | Wrong `R2_BUCKET` | Verify bucket name in Cloudflare Dashboard → R2 |
| Agent not reachable from Worker | Firewall blocking port | Check `ufw status` / `firewall-cmd --list-all`; ensure port 8787 is allowed from Worker IP |
| `ProtectSystem` write errors | Writing outside `ReadWritePaths` | Agent is trying to write outside `/var/lib/tseeder-agent`. Set `DOWNLOAD_DIR` inside that path |
| High memory usage | Too many concurrent jobs | Reduce `MAX_CONCURRENT_JOBS` |

### Common diagnostic commands

```bash
# Full service status with recent logs
systemctl status tseeder-agent

# Last 50 log lines
journalctl -u tseeder-agent -n 50 --no-pager

# Check the effective environment the service sees
systemctl show-environment
# Or read the env file directly:
sudo cat /etc/tseeder-agent.env

# Check open file descriptors
ls /proc/$(systemctl show -p MainPID --value tseeder-agent)/fd | wc -l

# Check disk usage of download directory
du -sh /var/lib/tseeder-agent/downloads/

# Test R2 credentials manually
curl -v \
  -H "Authorization: AWS4-HMAC-SHA256 ..." \
  "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}"
```

---

## Uninstall

```bash
# 1. Stop and disable the service
sudo systemctl stop tseeder-agent
sudo systemctl disable tseeder-agent

# 2. Remove systemd unit
sudo rm /etc/systemd/system/tseeder-agent.service
sudo systemctl daemon-reload

# 3. Remove installed files
sudo rm -rf /opt/tseeder-agent

# 4. Remove data directory (WARNING: deletes all downloaded files)
sudo rm -rf /var/lib/tseeder-agent

# 5. Remove environment file (WARNING: deletes all secrets)
sudo rm /etc/tseeder-agent.env

# 6. Remove service user
sudo userdel tseeder-agent

echo "tseeder-agent uninstalled."
```

> To keep data and secrets but remove the code, skip steps 4 and 5.
