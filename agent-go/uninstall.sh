#!/bin/bash
set -e

SERVICE_NAME="zoraxy-agent"
INSTALL_DIR="/opt/zoraxy-agent"

echo "=== Zoraxy Agent Uninstaller ==="
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo ./uninstall.sh)"
  exit 1
fi

echo "[1/3] Stopping and disabling service..."
systemctl stop ${SERVICE_NAME} 2>/dev/null || true
systemctl disable ${SERVICE_NAME} 2>/dev/null || true
rm -f /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload

echo "[2/3] Removing installation directory..."
rm -rf "$INSTALL_DIR"

echo "[3/3] Done."
echo ""
echo "Zoraxy agent has been removed."
