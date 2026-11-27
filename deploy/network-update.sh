#!/usr/bin/env bash
# Automatically checks GitHub every 3 minutes for new commits on origin/main.
# Preserves 100% of configuration (.env), database (data/network-state.json, dev.db),
# setup wizard completion state, and Root-CA certificates (certs/).
set -euo pipefail

DIR="${NETWORK_DIR:-/opt/network}"
BRANCH="${NETWORK_BRANCH:-main}"
cd "$DIR"
git_() { git -c safe.directory="$DIR" "$@"; }

old="$(git_ rev-parse HEAD 2>/dev/null || echo 'none')"
git_ fetch -q --depth 1 origin "$BRANCH"
new="$(git_ rev-parse FETCH_HEAD)"
[ "$old" = "$new" ] && exit 0

echo "[AUTO-UPDATE] New version detected (${old:0:7} -> ${new:0:7}). Backing up config & data..."
tmp_backup="$(mktemp -d)"
[ -f ".env" ] && cp -a ".env" "$tmp_backup/.env"
[ -d "data" ] && cp -a "data" "$tmp_backup/data"
[ -d "certs" ] && cp -a "certs" "$tmp_backup/certs"
[ -f "prisma/dev.db" ] && cp -a "prisma/dev.db" "$tmp_backup/dev.db"

git_ reset -q --hard FETCH_HEAD

# Restore all user configuration, onboarding state, SQLite DB & certificates
[ -f "$tmp_backup/.env" ] && cp -a "$tmp_backup/.env" ".env"
[ -d "$tmp_backup/data" ] && { mkdir -p data; cp -a "$tmp_backup/data/." "data/"; }
[ -d "$tmp_backup/certs" ] && { mkdir -p certs; cp -a "$tmp_backup/certs/." "certs/"; }
[ -f "$tmp_backup/dev.db" ] && cp -a "$tmp_backup/dev.db" "prisma/dev.db"
rm -rf "$tmp_backup"

chmod +x manage.sh admin.sh install.sh proxmox.sh deploy/*.sh install/*.sh 2>/dev/null || true

if ! git_ diff --quiet "$old" HEAD -- package.json package-lock.json 2>/dev/null; then
  echo "[AUTO-UPDATE] Updating npm packages..."
  npm install --no-audit --no-fund --loglevel=error
fi

DATABASE_URL="file:./dev.db" npx prisma generate >/dev/null 2>&1 || true
DATABASE_URL="file:./dev.db" npx prisma db push --skip-generate >/dev/null 2>&1 || true

echo "[AUTO-UPDATE] Rebuilding production bundle..."
npm run build

if [ -d ".next/standalone" ]; then
  mkdir -p .next/standalone/.next
  cp -r public .next/standalone/ 2>/dev/null || true
  cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-active network-admin >/dev/null 2>&1; then
  systemctl restart network-admin
fi

echo "[AUTO-UPDATE] Successfully updated ${old:0:7} -> ${new:0:7} (all config & setup state preserved)."
