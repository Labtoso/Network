#!/usr/bin/env bash
# Build the candidate before replacing the running installation.
set -euo pipefail

DIR="${NETWORK_DIR:-/opt/network}"
BRANCH="${NETWORK_BRANCH:-main}"
cd "$DIR"
DIR="$(pwd -P)"
git_() { git -c core.fileMode=false -c safe.directory="$DIR" "$@"; }

exec 9>"$DIR/.network-update.lock"
flock -n 9 || exit 0

old="$(git_ rev-parse HEAD)"
git_ fetch -q origin "$BRANCH"
new="$(git_ rev-parse FETCH_HEAD)"
[ "$old" != "$new" ] || exit 0
if ! git_ diff --quiet HEAD --; then
  echo "[AUTO-UPDATE] Tracked files have local changes. Update deferred." >&2
  exit 1
fi

stage="$(mktemp -d "$DIR/.network-update.XXXXXX")"
old_bundle="$stage/previous-build"
candidate="$stage/source"
cleanup() {
  git_ worktree remove --force "$candidate" 2>/dev/null || true
  rm -rf -- "$stage"
}
trap cleanup EXIT

echo "[AUTO-UPDATE] Building ${new:0:7} (installed: ${old:0:7})"
git_ worktree add -q --detach "$candidate" "$new"
if [ -f .env ]; then cp -p .env "$candidate/.env"; fi
(
  cd "$candidate"
  if [ -f package-lock.json ]; then
    npm ci --include=dev --no-audit --no-fund
  else
    npm install --include=dev --no-audit --no-fund
  fi
  DATABASE_URL="file:./dev.db" npm run db:generate
  npm run build
  test -f .next/standalone/server.js
  cp -r public .next/standalone/
  cp -r .next/static .next/standalone/.next/
)

service=network-admin.service
running=false
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$service"; then
  running=true
fi

# Existing standalone installations may have written state inside the build.
if "$running"; then systemctl stop "$service"; fi
rollback() {
  trap - ERR
  git_ reset --keep "$old" || true
  if [ -d "$old_bundle" ]; then
    if [ -d .next ]; then mv .next "$stage/failed-build"; fi
    mv "$old_bundle" .next
  elif [ -d .next/standalone ] && [ ! -d "$candidate/.next" ]; then
    mv .next "$stage/failed-build"
  fi
  if "$running"; then systemctl start "$service" || true; fi
}
trap rollback ERR

node "$candidate/deploy/preserve-setup-state.mjs"

git_ reset --keep "$new"
chmod +x deploy/network-update.sh
if [ -d .next ]; then mv .next "$old_bundle"; fi
mv "$candidate/.next" .next
if "$running"; then systemctl start "$service"; fi

trap - ERR
echo "[AUTO-UPDATE] Installed ${new:0:7}"
