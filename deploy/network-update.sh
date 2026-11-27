#!/usr/bin/env bash
# Pulls new versions of Labtoso Network from GitHub, rebuilds if needed, and restarts it.
# Runs every 15 minutes through network-update.timer (set up by install.sh / manage.sh).
set -euo pipefail

DIR="${NETWORK_DIR:-/opt/network}"
BRANCH="${NETWORK_BRANCH:-main}"
cd "$DIR"
git_() { git -c safe.directory="$DIR" "$@"; }

old="$(git_ rev-parse HEAD)"
git_ fetch -q --depth 1 origin "$BRANCH"
new="$(git_ rev-parse FETCH_HEAD)"
[ "$old" = "$new" ] && exit 0

echo "New version detected: ${old:0:7} -> ${new:0:7}"
./manage.sh update
