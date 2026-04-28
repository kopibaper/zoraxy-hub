#!/bin/bash
set -e

# ============================================================
# Zoraxy Agent — Online Installer
# Downloads the latest binary from GitHub and sets up systemd.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/kopibaper/zoraxy-hub/main/agent-go/online-install.sh | sudo bash -s -- \
#     --api-key "zhub_ak_..." \
#     --agent-port 9191 \
#     --zoraxy-host localhost \
#     --zoraxy-port 8000 \
#     --zoraxy-user admin \
#     --zoraxy-pass password
#
# All flags are optional — the script will prompt for missing
# values or fall back to sensible defaults.
# ============================================================

REPO="kopibaper/zoraxy-hub"
INSTALL_DIR="/opt/zoraxy-agent"
SERVICE_NAME="zoraxy-agent"
BINARY_NAME="zoraxy-agent"

# Defaults
API_KEY=""
LISTEN_ADDR="0.0.0.0"
AGENT_PORT="9191"
ZORAXY_HOST="localhost"
ZORAXY_PORT="8000"
ZORAXY_USER="admin"
ZORAXY_PASS="password"
ZORAXY_DATA_DIR="/opt/zoraxy"
DOCKER_ENABLED="false"
DOCKER_CONTAINER="zoraxy"
VERSION="latest"

# ── Parse flags ──────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key)        API_KEY="$2";          shift 2 ;;
    --agent-port)     AGENT_PORT="$2";       shift 2 ;;
    --listen-addr)    LISTEN_ADDR="$2";      shift 2 ;;
    --zoraxy-host)    ZORAXY_HOST="$2";      shift 2 ;;
    --zoraxy-port)    ZORAXY_PORT="$2";      shift 2 ;;
    --zoraxy-user)    ZORAXY_USER="$2";      shift 2 ;;
    --zoraxy-pass)    ZORAXY_PASS="$2";      shift 2 ;;
    --zoraxy-data)    ZORAXY_DATA_DIR="$2";  shift 2 ;;
    --docker)         DOCKER_ENABLED="true"; shift   ;;
    --docker-name)    DOCKER_CONTAINER="$2"; DOCKER_ENABLED="true"; shift 2 ;;
    --version)        VERSION="$2";          shift 2 ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --api-key KEY        Agent API key (required)"
      echo "  --agent-port PORT    Agent listen port (default: 9191)"
      echo "  --listen-addr ADDR   Agent listen address (default: 0.0.0.0)"
      echo "  --zoraxy-host HOST   Zoraxy host (default: localhost)"
      echo "  --zoraxy-port PORT   Zoraxy port (default: 8000)"
      echo "  --zoraxy-user USER   Zoraxy username (default: admin)"
      echo "  --zoraxy-pass PASS   Zoraxy password (default: password)"
      echo "  --zoraxy-data DIR    Zoraxy data directory (default: /opt/zoraxy)"
      echo "  --docker             Enable Docker mode"
      echo "  --docker-name NAME   Docker container name (default: zoraxy)"
      echo "  --version VER        Release version tag (default: latest)"
      echo "  --help               Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ── Preflight checks ────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Zoraxy Agent — Online Installer            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo)"
  exit 1
fi

if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
  echo "Error: curl or wget is required"
  exit 1
fi

# ── Detect architecture ──────────────────────────────────────
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  ARCH_SUFFIX="linux-amd64" ;;
  aarch64) ARCH_SUFFIX="linux-arm64" ;;
  arm64)   ARCH_SUFFIX="linux-arm64" ;;
  *)
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

echo "  Architecture: $ARCH ($ARCH_SUFFIX)"

# ── Resolve download URL ────────────────────────────────────
DOWNLOAD_URL=""

if [ "$VERSION" = "latest" ]; then
  echo "  Fetching latest release..."
  if command -v curl &>/dev/null; then
    RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null || echo "")
  else
    RELEASE_JSON=$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null || echo "")
  fi

  if [ -n "$RELEASE_JSON" ]; then
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep -o "\"browser_download_url\"[[:space:]]*:[[:space:]]*\"[^\"]*${BINARY_NAME}-${ARCH_SUFFIX}\"" | head -1 | grep -o 'https://[^"]*')
    RESOLVED_VERSION=$(echo "$RELEASE_JSON" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | grep -o '"v[^"]*"' | tr -d '"')
  fi

  if [ -z "$DOWNLOAD_URL" ]; then
    echo "  No GitHub release found, trying direct build URL..."
    DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}-${ARCH_SUFFIX}"
    RESOLVED_VERSION="latest"
  fi
else
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}-${ARCH_SUFFIX}"
  RESOLVED_VERSION="$VERSION"
fi

echo "  Version:  ${RESOLVED_VERSION:-latest}"
echo "  Download: $DOWNLOAD_URL"
echo ""

# ── Generate API key if not provided ─────────────────────────
if [ -z "$API_KEY" ]; then
  API_KEY="zhub_ak_$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  echo "  Generated API key: $API_KEY"
  echo ""
fi

# ── Download binary ──────────────────────────────────────────
echo "[1/5] Downloading agent binary..."
mkdir -p "$INSTALL_DIR"

TMPFILE=$(mktemp)
if command -v curl &>/dev/null; then
  HTTP_CODE=$(curl -fsSL -w "%{http_code}" -o "$TMPFILE" "$DOWNLOAD_URL" 2>/dev/null || echo "000")
else
  wget -qO "$TMPFILE" "$DOWNLOAD_URL" 2>/dev/null && HTTP_CODE="200" || HTTP_CODE="000"
fi

if [ "$HTTP_CODE" != "200" ] || [ ! -s "$TMPFILE" ]; then
  rm -f "$TMPFILE"
  echo ""
  echo "Error: Failed to download binary (HTTP $HTTP_CODE)"
  echo ""
  echo "The release may not exist yet. You can:"
  echo "  1. Build manually: cd agent-go && make build-all"
  echo "  2. Create a GitHub release with the binary attached"
  echo "  3. Specify a version: --version v1.0.0"
  exit 1
fi

mv "$TMPFILE" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"
echo "  Binary installed to $INSTALL_DIR/$BINARY_NAME"

# ── Write config ─────────────────────────────────────────────
echo "[2/5] Writing agent.json..."

if [ -f "$INSTALL_DIR/agent.json" ]; then
  cp "$INSTALL_DIR/agent.json" "$INSTALL_DIR/agent.json.bak"
  echo "  Backed up existing config to agent.json.bak"
fi

cat > "$INSTALL_DIR/agent.json" <<AGENTCFG
{
  "apiKey": "${API_KEY}",
  "listenAddr": "${LISTEN_ADDR}",
  "listenPort": ${AGENT_PORT},
  "zoraxy": {
    "host": "${ZORAXY_HOST}",
    "port": ${ZORAXY_PORT},
    "username": "${ZORAXY_USER}",
    "password": "${ZORAXY_PASS}"
  },
  "zoraxyDataDir": "${ZORAXY_DATA_DIR}",
  "docker": {
    "enabled": ${DOCKER_ENABLED},
    "containerName": "${DOCKER_CONTAINER}"
  }
}
AGENTCFG

chmod 600 "$INSTALL_DIR/agent.json"
echo "  Config written to $INSTALL_DIR/agent.json"

# ── Install systemd service ──────────────────────────────────
echo "[3/5] Installing systemd service..."

cat > /etc/systemd/system/${SERVICE_NAME}.service <<SVCFILE
[Unit]
Description=Zoraxy Agent - Remote VPS management for ZoraxyHub
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/${BINARY_NAME}
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5

StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
SVCFILE

systemctl daemon-reload

# ── Enable & start ───────────────────────────────────────────
echo "[4/5] Enabling service..."
systemctl enable ${SERVICE_NAME} >/dev/null 2>&1

echo "[5/5] Starting service..."
systemctl start ${SERVICE_NAME}

# ── Verify ───────────────────────────────────────────────────
sleep 2
if systemctl is-active --quiet ${SERVICE_NAME}; then
  STATUS="running"
else
  STATUS="not running (check: journalctl -u ${SERVICE_NAME} -n 20)"
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Installation Complete                       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Status:    $STATUS"
echo "  Binary:    $INSTALL_DIR/$BINARY_NAME"
echo "  Config:    $INSTALL_DIR/agent.json"
echo "  Port:      $AGENT_PORT"
echo "  API Key:   $API_KEY"
echo ""
echo "  Commands:"
echo "    systemctl status $SERVICE_NAME"
echo "    journalctl -u $SERVICE_NAME -f"
echo "    systemctl restart $SERVICE_NAME"
echo ""
echo "  Add this node in ZoraxyHub with:"
echo "    Host:       $(hostname -I 2>/dev/null | awk '{print $1}' || echo '<this-server-ip>')"
echo "    Agent Port:  $AGENT_PORT"
echo "    API Key:     $API_KEY"
echo ""
