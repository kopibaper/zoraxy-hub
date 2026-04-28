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

if ! command -v bun &> /dev/null; then
  echo "[1/5] Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun
else
  echo "[1/5] Bun already installed: $(bun --version)"
fi

echo "[2/5] Setting up $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp zoraxy-agent.ts "$INSTALL_DIR/"
cp package.json "$INSTALL_DIR/"

if [ -f "$INSTALL_DIR/agent.json" ]; then
  echo "  agent.json already exists, keeping existing config"
else
  if [ -f agent.json ]; then
    cp agent.json "$INSTALL_DIR/agent.json"
    echo "  Copied agent.json from current directory"
  else
    cp agent.json.example "$INSTALL_DIR/agent.json"
    echo "  Copied agent.json.example — EDIT /opt/zoraxy-agent/agent.json before starting!"
  fi
fi

chmod 600 "$INSTALL_DIR/agent.json"

echo "[3/5] Installing systemd service..."
cp zoraxy-agent.service /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload

echo "[4/5] Enabling service to start on boot..."
systemctl enable ${SERVICE_NAME}

echo "[5/5] Starting service..."
systemctl start ${SERVICE_NAME}

echo ""
echo "=== Installation complete ==="
echo ""
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
