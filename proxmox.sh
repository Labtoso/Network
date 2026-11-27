#!/usr/bin/env bash
# Forwarding wrapper so both install.sh and proxmox.sh work identically on Proxmox VE
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${DIR}/install.sh" ]; then
  exec "${DIR}/install.sh" "$@"
else
  exec bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh)"
fi
