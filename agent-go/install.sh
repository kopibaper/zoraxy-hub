#!/bin/bash
set -e

INSTALL_DIR="/opt/zoraxy-agent"
SERVICE_NAME="zoraxy-agent"

echo "=== Zoraxy Agent Installer ==="
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo ./install.sh)"
  exit 1
fi

ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  BINARY="zoraxy-agent-linux-amd64" ;;
  aarch64) BINARY="zoraxy-agent-linux-arm64" ;;
  *)
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

if [ ! -f "$BINARY" ]; then
  if [ -f "zoraxy-agent" ]; then
    BINARY="zoraxy-agent"
  else
    echo "Error: Binary '$BINARY' not found."
    echo ""
    echo "Build it first (requires Go 1.21+):"
    echo "  make build-linux       # for x64"
    echo "  make build-linux-arm   # for ARM64"
    echo "  make build-all         # both"
    echo ""
    echo "Or download a pre-built binary from GitHub releases."
    exit 1
  fi
fi

echo "[1/4] Setting up $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp "$BINARY" "$INSTALL_DIR/zoraxy-agent"
chmod +x "$INSTALL_DIR/zoraxy-agent"

if [ -f "$INSTALL_DIR/agent.json" ]; then
  echo "  agent.json already exists, keeping existing config"
else
  if [ -f agent.json ]; then
    cp agent.json "$INSTALL_DIR/agent.json"
    echo "  Copied agent.json from current directory"
  elif [ -f agent.json.example ]; then
    cp agent.json.example "$INSTALL_DIR/agent.json"
    echo "  Copied agent.json.example — EDIT /opt/zoraxy-agent/agent.json before starting!"
  else
    echo "  WARNING: No agent.json found. Create one at $INSTALL_DIR/agent.json"
  fi
fi

chmod 600 "$INSTALL_DIR/agent.json" 2>/dev/null || true

echo "[2/4] Installing systemd service..."
cp zoraxy-agent.service /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload

echo "[3/4] Enabling service to start on boot..."
systemctl enable ${SERVICE_NAME}

echo "[4/4] Starting service..."
systemctl start ${SERVICE_NAME}

echo ""
echo "=== Installation complete ==="
echo ""
echo "  Binary:  $INSTALL_DIR/zoraxy-agent"
echo "  Config:  $INSTALL_DIR/agent.json"
echo "  Status:  systemctl status $SERVICE_NAME"
echo "  Logs:    journalctl -u $SERVICE_NAME -f"
echo "  Restart: systemctl restart $SERVICE_NAME"
echo "  Stop:    systemctl stop $SERVICE_NAME"
echo ""

if grep -q '"zhub_ak_0123456789abcdef' "$INSTALL_DIR/agent.json" 2>/dev/null; then
  echo "WARNING: You are using the example API key!"
  echo "  Edit $INSTALL_DIR/agent.json and set your own apiKey,"
  echo "  then run: systemctl restart $SERVICE_NAME"
  echo ""
fi
