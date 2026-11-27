#!/usr/bin/env bash
# Removes the Labtoso Network service, auto-update timer, and files.
#   curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/uninstall.sh | sudo bash
set -euo pipefail
DIR="${1:-/opt/network}"
[ "$(id -u)" -eq 0 ] || { echo "Please run as root (sudo)."; exit 1; }

if [ -f /etc/systemd/system/network-update.timer ]; then
  systemctl disable --now network-update.timer 2>/dev/null || true
  rm -f /etc/systemd/system/network-update.timer /etc/systemd/system/network-update.service
fi
if [ -f /etc/systemd/system/network-admin-cloudflared.service ]; then
  systemctl disable --now network-admin-cloudflared 2>/dev/null || true
  rm -f /etc/systemd/system/network-admin-cloudflared.service
fi
if [ -f /etc/systemd/system/network-admin.service ]; then
  systemctl disable --now network-admin 2>/dev/null || true
  rm -f /etc/systemd/system/network-admin.service
  systemctl daemon-reload
fi
if [ -f /etc/caddy/sites/network.caddy ]; then
  rm -f /etc/caddy/sites/network.caddy
  systemctl reload caddy 2>/dev/null || true
fi
rm -rf "$DIR"
echo "Labtoso Network Control Suite removed."
