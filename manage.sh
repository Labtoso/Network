#!/usr/bin/env bash
# ============================================================================
# LABTOSO NETWORK - MANAGEMENT CLI (manage.sh)
# Befehle: install | uninstall | update | info | status | logs | setup | duckdns | help
# ============================================================================
set -Eeuo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8 DEBIAN_FRONTEND=noninteractive

APP_NAME="network-admin"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${APP_DIR}/.env"
STATE_DIR="/var/lib/network-admin"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
DUCKDNS_SERVICE="/etc/systemd/system/network-duckdns.service"
DUCKDNS_TIMER="/etc/systemd/system/network-duckdns.timer"
CADDY_SERVICE="/etc/systemd/system/caddy.service"
CADDY_DIR="/etc/caddy"
MIN_NODE_MAJOR=20
NODE_SETUP_MAJOR=22
NONINTERACTIVE="${NETWORK_NONINTERACTIVE:-0}"

c_blue="\033[38;5;39m"
c_green="\033[32m"
c_amber="\033[33m"
c_red="\033[31m"
c_dim="\033[2m"
c_bold="\033[1m"
c_reset="\033[0m"

banner() {
  printf "${c_blue}${c_bold}"
  cat <<'ART'
    __          __    __                   _   __     __                      __
   / /   ____ _/ /_  / /_____  ________   / | / /__  / /___      ______  ____/ /__
  / /   / __ `/ __ \/ __/ __ \/ ___/ __ \/  |/ / _ \/ __/ | /| / / __ \/ ___/ //_/
 / /___/ /_/ / /_/ / /_/ /_/ (__  ) /_/ / /|  /  __/ /_ | |/ |/ / /_/ / /  / ,<
/_____/\__,_/_.___/\__/\____/____/\____/_/ |_/\___/\__/ |__/|__/\____/_/  /_/|_|
ART
  printf "${c_reset}"
  printf "  ${c_dim}AdGuard Admin-Panel · DuckDNS + Caddy · Roaming DoH/DoT · Google Login${c_reset}\n\n"
}

say()  { printf " ${c_green}==>${c_reset} ${c_bold}%s${c_reset}\n" "$*"; }
info() { printf "     ${c_dim}•${c_reset} %s\n" "$*"; }
warn() { printf " ${c_amber}[!]${c_reset} %s\n" "$*"; }
die()  { printf "\n ${c_red}[✗] %s${c_reset}\n\n" "$*" >&2; exit 1; }
ok()   { printf " ${c_green}[✓]${c_reset} %s\n" "$*"; }

trap 'die "Abbruch in Zeile ${LINENO}: ${BASH_COMMAND}"' ERR

require_root() {
  [ "$(id -u)" -eq 0 ] || die "Bitte als root ausfuehren: sudo ./manage.sh $*"
}

env_get() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  { grep -E "^${key}=" "$ENV_FILE" || true; } | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}

env_set() {
  local key="$1" value="$2"
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    local escaped
    escaped="$(printf '%s' "$value" | sed -e 's/[\/&|]/\\&/g')"
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

ask() {
  # ask VAR "Frage" "Standardwert" [secret]
  local var="$1" question="$2" default="${3:-}" secret="${4:-}" answer=""
  if [ "$NONINTERACTIVE" = "1" ]; then
    printf -v "$var" '%s' "$default"
    return
  fi
  local shown="$default"
  [ -n "$secret" ] && [ -n "$default" ] && shown="(gesetzt, Enter = behalten)"
  if [ -n "$secret" ]; then
    read -r -s -p "  ${question} [${shown}]: " answer </dev/tty || true
    echo
  else
    read -r -p "  ${question} [${shown}]: " answer </dev/tty || true
  fi
  printf -v "$var" '%s' "${answer:-$default}"
}

confirm() {
  local question="$1" answer=""
  [ "$NONINTERACTIVE" = "1" ] && return 1
  read -r -p "  ${question} [y/N]: " answer </dev/tty || true
  [[ "$answer" =~ ^([yYjJ]|yes|ja)$ ]]
}

arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo amd64 ;;
    aarch64|arm64) echo arm64 ;;
    armv7l) echo armv7 ;;
    *) die "Nicht unterstuetzte Architektur: $(uname -m)" ;;
  esac
}

# ----------------------------------------------------------------------------
# 1. SYSTEM-ABHAENGIGKEITEN
# ----------------------------------------------------------------------------
ensure_system_packages() {
  say "Pruefe System-Abhaengigkeiten..."
  local pkgs=(curl wget git jq openssl ca-certificates sqlite3 procps iproute2 gnupg)
  local missing=()
  for p in "${pkgs[@]}"; do
    dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    info "Installiere: ${missing[*]}"
    apt-get update -qq
    apt-get install -y -qq "${missing[@]}" >/dev/null
  fi
  ok "curl, wget, git, jq, openssl, ca-certificates, sqlite3 vorhanden"
}

ensure_node() {
  say "Pruefe Node.js (>= ${MIN_NODE_MAJOR}.x LTS)..."
  local major=0
  command -v node >/dev/null 2>&1 && major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt "$MIN_NODE_MAJOR" ]; then
    info "Installiere Node.js ${NODE_SETUP_MAJOR} LTS (NodeSource)..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_SETUP_MAJOR}.x" | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  fi
  ok "Node.js $(node -v) · npm v$(npm -v)"
}

ensure_caddy() {
  say "Pruefe Caddy mit DuckDNS-Modul..."
  if command -v caddy >/dev/null 2>&1 && caddy list-modules 2>/dev/null | grep -q '^dns.providers.duckdns$'; then
    ok "Caddy $(caddy version | awk '{print $1}') mit dns.providers.duckdns"
  else
    info "Lade Caddy-Build mit github.com/caddy-dns/duckdns (offizieller Download-Dienst)..."
    local tmp
    tmp="$(mktemp)"
    curl -fsSL --retry 3 -o "$tmp" "https://caddyserver.com/api/download?os=linux&arch=$(arch)&p=github.com%2Fcaddy-dns%2Fduckdns"
    install -m 0755 "$tmp" /usr/bin/caddy
    rm -f "$tmp"
    caddy list-modules | grep -q '^dns.providers.duckdns$' || die "Caddy-Build ohne DuckDNS-Modul."
    ok "Caddy $(caddy version | awk '{print $1}') installiert"
  fi
  getent group caddy >/dev/null || groupadd --system caddy
  id caddy >/dev/null 2>&1 || useradd --system --gid caddy --create-home --home-dir /var/lib/caddy --shell /usr/sbin/nologin --comment "Caddy web server" caddy
  mkdir -p "$CADDY_DIR/sites.d" /var/lib/caddy
  chown -R caddy:caddy /var/lib/caddy
}

ensure_tailscale() {
  say "Pruefe Tailscale (VPN-Fallback)..."
  if ! command -v tailscale >/dev/null 2>&1; then
    if [ -e /dev/net/tun ]; then
      curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1 || warn "Tailscale-Installation fehlgeschlagen."
    else
      warn "/dev/net/tun fehlt (LXC ohne TUN). Tailscale wird uebersprungen."
      return
    fi
  fi
  command -v tailscale >/dev/null 2>&1 || return
  # Caddy darf Tailscale-HTTPS-Zertifikate (*.ts.net) beim Daemon abholen
  if [ -f /etc/default/tailscaled ] && ! grep -q '^TS_PERMIT_CERT_UID=' /etc/default/tailscaled; then
    echo 'TS_PERMIT_CERT_UID=caddy' >>/etc/default/tailscaled
    systemctl restart tailscaled 2>/dev/null || true
  fi
  local key
  key="$(env_get TS_AUTHKEY)"
  if [ -n "$key" ] && ! tailscale status >/dev/null 2>&1; then
    tailscale up --authkey="$key" --hostname="network" --accept-dns=false >/dev/null 2>&1 && ok "Tailscale verbunden" || warn "tailscale up fehlgeschlagen (Key pruefen)."
    env_set TS_AUTHKEY ""
  fi
  tailscale ip -4 >/dev/null 2>&1 && ok "Tailscale IP: $(tailscale ip -4 | head -n1)" || info "Tailscale nicht verbunden (optional)."
}

# ----------------------------------------------------------------------------
# 2. SETUP-ASSISTENT (TERMINAL)
# ----------------------------------------------------------------------------
cmd_setup() {
  require_root setup
  [ "$NONINTERACTIVE" = "1" ] || banner
  say "Terminal-Setup-Assistent"
  [ -f "$ENV_FILE" ] || { cp "$APP_DIR/.env.example" "$ENV_FILE"; chmod 600 "$ENV_FILE"; }

  local duck token tskey ag_url ag_user ag_pass gid email custom acme cors
  echo
  info "DuckDNS: Subdomain und Token findest du nach dem Login auf https://www.duckdns.org"
  ask duck "DuckDNS-Subdomain (ohne .duckdns.org)" "$(env_get DUCKDNS_DOMAIN)"
  duck="${duck%.duckdns.org}"
  ask token "DuckDNS-Token" "$(env_get DUCKDNS_TOKEN)" secret
  ask custom "Eigene Backend-Domain als CNAME (optional, z. B. api.labtoso.de)" "$(env_get CUSTOM_DOMAIN)"
  echo
  info "Tailscale Auth-Key (optional): https://login.tailscale.com/admin/settings/keys"
  ask tskey "Tailscale Auth-Key" "$(env_get TS_AUTHKEY)" secret
  echo
  ask ag_url "AdGuard Home Adresse" "$(env_get ADGUARD_URL)"
  ask ag_user "AdGuard Benutzer" "$(env_get ADGUARD_USER)"
  ask ag_pass "AdGuard Passwort" "$(env_get ADGUARD_PASS)" secret
  echo
  info "Google OAuth Client-ID (Typ Webanwendung): https://console.cloud.google.com/apis/credentials"
  ask gid "Google Client-ID" "$(env_get GOOGLE_CLIENT_ID)"
  ask email "Freigeschaltete Google-Adresse(n)" "$(env_get ALLOWED_EMAIL)"
  ask acme "E-Mail fuer Let's Encrypt" "$(env_get ACME_EMAIL || true)"
  [ -n "$acme" ] || acme="${email%%,*}"
  ask cors "Erlaubte Frontends (GitHub Pages Origin)" "$(env_get CORS_ORIGINS)"

  [ -n "$duck" ] || die "DuckDNS-Subdomain ist Pflicht."
  [ -n "$token" ] || die "DuckDNS-Token ist Pflicht."

  env_set DUCKDNS_DOMAIN "$duck"
  env_set DUCKDNS_TOKEN "$token"
  env_set CUSTOM_DOMAIN "$custom"
  env_set TS_AUTHKEY "$tskey"
  env_set ADGUARD_URL "${ag_url%/}"
  env_set ADGUARD_USER "$ag_user"
  env_set ADGUARD_PASS "$ag_pass"
  env_set GOOGLE_CLIENT_ID "$gid"
  env_set ALLOWED_EMAIL "$email"
  env_set ACME_EMAIL "$acme"
  env_set CORS_ORIGINS "$cors"
  env_set DATABASE_URL "\"file:${APP_DIR}/data/network.db\""
  env_set STATIC_DIR "${APP_DIR}/out"
  [ -n "$(env_get JWT_SECRET)" ] || env_set JWT_SECRET "$(openssl rand -hex 32)"
  [ -n "$(env_get ENCRYPTION_KEY)" ] || env_set ENCRYPTION_KEY "$(openssl rand -hex 32)"
  [ -n "$(env_get PORT)" ] || env_set PORT 8787
  ok "Konfiguration gespeichert: ${ENV_FILE}"

  if [ -f "$SERVICE_FILE" ]; then
    write_caddy_config
    systemctl restart "$APP_NAME" caddy
    bash "$APP_DIR/duckdns-update.sh" || true
    ok "Dienste mit neuer Konfiguration neu gestartet"
  fi
}

# ----------------------------------------------------------------------------
# 3. BUILD & DIENSTE
# ----------------------------------------------------------------------------
build_app() {
  cd "$APP_DIR"
  say "Installiere npm-Pakete..."
  npm ci --no-audit --no-fund --loglevel=error
  say "Prisma-Client & Datenbank..."
  mkdir -p "$APP_DIR/data"
  set -a; # shellcheck disable=SC1090
  . "$ENV_FILE"; set +a
  npx prisma generate >/dev/null
  npx prisma migrate deploy
  say "Baue Backend und Frontend (npm run build)..."
  NEXT_PUBLIC_API_BASE="" NEXT_PUBLIC_BASE_PATH="" NEXT_TELEMETRY_DISABLED=1 npm run build
  ok "Build fertig: dist-server/ und out/"
}

write_caddy_config() {
  say "Schreibe Caddy-Konfiguration..."
  mkdir -p "$CADDY_DIR/sites.d"
  install -m 0644 "$APP_DIR/Caddyfile" "$CADDY_DIR/Caddyfile"
  umask 077
  cat >"$CADDY_DIR/network.env" <<CENV
DUCKDNS_DOMAIN=$(env_get DUCKDNS_DOMAIN)
DUCKDNS_TOKEN=$(env_get DUCKDNS_TOKEN)
ACME_EMAIL=$(env_get ACME_EMAIL)
BACKEND_PORT=$(env_get PORT)
STATIC_DIR=${APP_DIR}/out
HOME=/var/lib/caddy
XDG_DATA_HOME=/var/lib/caddy/.local/share
XDG_CONFIG_HOME=/var/lib/caddy/.config
CENV
  umask 022
  chown root:caddy "$CADDY_DIR/network.env"
  chmod 640 "$CADDY_DIR/network.env"

  local custom
  custom="$(env_get CUSTOM_DOMAIN)"
  rm -f "$CADDY_DIR/sites.d/custom.caddy" "$CADDY_DIR/sites.d/tailscale.caddy"
  if [ -n "$custom" ]; then
    printf '%s {\n\timport network_app\n}\n' "$custom" >"$CADDY_DIR/sites.d/custom.caddy"
    info "Eigene Domain: ${custom} (Zertifikat per HTTP-01/TLS-ALPN, Port 80/443 muessen offen sein)"
  fi
  if command -v tailscale >/dev/null 2>&1; then
    local tsname
    tsname="$(tailscale status --json 2>/dev/null | jq -r '.Self.DNSName // empty' | sed 's/\.$//')"
    if [ -n "$tsname" ]; then
      printf '%s {\n\timport network_app\n}\n' "$tsname" >"$CADDY_DIR/sites.d/tailscale.caddy"
      info "Tailscale-HTTPS: https://${tsname}"
    fi
  fi
  caddy validate --config "$CADDY_DIR/Caddyfile" --adapter caddyfile --envfile "$CADDY_DIR/network.env" >/dev/null 2>&1 \
    || { caddy validate --config "$CADDY_DIR/Caddyfile" --adapter caddyfile --envfile "$CADDY_DIR/network.env" || true; die "Caddyfile ungueltig."; }
  ok "Caddyfile gueltig"
}

install_units() {
  say "Richte systemd-Dienste ein..."
  sed "s|__APP_DIR__|${APP_DIR}|g" "$APP_DIR/deploy/network-admin.service" >"$SERVICE_FILE"
  sed "s|__APP_DIR__|${APP_DIR}|g" "$APP_DIR/deploy/network-duckdns.service" >"$DUCKDNS_SERVICE"
  install -m 0644 "$APP_DIR/deploy/network-duckdns.timer" "$DUCKDNS_TIMER"
  install -m 0644 "$APP_DIR/deploy/caddy.service" "$CADDY_SERVICE"
  mkdir -p "$STATE_DIR"
  systemctl daemon-reload
  systemctl enable --now network-duckdns.timer >/dev/null
  systemctl start network-duckdns.service || warn "DuckDNS-Update fehlgeschlagen (Token/Domain pruefen)."
  systemctl enable "$APP_NAME" caddy >/dev/null
  systemctl restart "$APP_NAME"
  systemctl restart caddy
  ok "Dienste aktiv: ${APP_NAME}, caddy, network-duckdns.timer"
}

wait_healthy() {
  local port
  port="$(env_get PORT)"
  for _ in $(seq 1 30); do
    curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1 && { ok "Backend antwortet auf Port ${port}"; return 0; }
    sleep 1
  done
  warn "Backend antwortet nicht. Logs: ./manage.sh logs"
  return 1
}

summary() {
  local duck custom ts lan
  duck="$(env_get DUCKDNS_DOMAIN)"
  custom="$(env_get CUSTOM_DOMAIN)"
  lan="$(hostname -I 2>/dev/null | awk '{print $1}')"
  ts="$(tailscale status --json 2>/dev/null | jq -r '.Self.DNSName // empty' | sed 's/\.$//' || true)"
  echo
  printf " ${c_green}${c_bold}Fertig! Zugang:${c_reset}\n"
  info "Panel (DuckDNS):   https://${duck}.duckdns.org"
  [ -n "$custom" ] && info "Panel (Domain):    https://${custom}"
  [ -n "$ts" ] && info "Panel (Tailscale): https://${ts}"
  info "Panel (Pages):     $(env_get CORS_ORIGINS | cut -d, -f1)"
  info "Sperrseite (LAN):  http://${lan}  → in AdGuard Blockmodus 'Benutzerdefinierte IP' = ${lan}"
  info "Router-Freigaben:  TCP 443 (HTTPS/DoH) und TCP 853 (DoT) auf ${lan}"
  echo
}

cmd_install() {
  require_root install
  banner
  ensure_system_packages
  ensure_node
  ensure_caddy
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
  if [ ! -f "$ENV_FILE" ] || [ -z "$(env_get DUCKDNS_TOKEN)" ] || [ "$(env_get DUCKDNS_TOKEN)" = "00000000-0000-0000-0000-000000000000" ]; then
    cmd_setup
  fi
  [ -n "$(env_get JWT_SECRET)" ] || env_set JWT_SECRET "$(openssl rand -hex 32)"
  [ -n "$(env_get ENCRYPTION_KEY)" ] || env_set ENCRYPTION_KEY "$(openssl rand -hex 32)"
  ensure_tailscale
  build_app
  install_units
  write_caddy_config
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
  wait_healthy || true
  summary
}

# ----------------------------------------------------------------------------
# 4. UPDATE
# ----------------------------------------------------------------------------
cmd_update() {
  require_root update
  banner
  cd "$APP_DIR"
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
  local before after
  before="$(git rev-parse HEAD)"
  say "git pull..."
  git fetch --quiet origin
  git pull --ff-only --quiet || die "git pull nicht moeglich (lokale Aenderungen?). 'git status' pruefen."
  after="$(git rev-parse HEAD)"
  if [ "$before" = "$after" ] && [ "${1:-}" != "--force" ]; then
    ok "Bereits aktuell ($(git rev-parse --short HEAD)). Neu bauen erzwingen: ./manage.sh update --force"
    return 0
  fi
  info "$(git log --oneline "${before}..${after}" | wc -l) neue Commits"
  trap - ERR
  if ! build_app; then
    warn "Build fehlgeschlagen, setze auf ${before:0:7} zurueck..."
    git reset --hard --quiet "$before"
    build_app || die "Auch der alte Stand baut nicht mehr. Bitte Logs pruefen."
    systemctl restart "$APP_NAME"
    die "Update abgebrochen, alter Stand laeuft wieder."
  fi
  trap 'die "Abbruch in Zeile ${LINENO}: ${BASH_COMMAND}"' ERR
  install_units
  write_caddy_config
  systemctl reload caddy || systemctl restart caddy
  wait_healthy
  ok "Update auf $(git rev-parse --short HEAD) abgeschlossen"
}

# ----------------------------------------------------------------------------
# 5. UNINSTALL
# ----------------------------------------------------------------------------
cmd_uninstall() {
  require_root uninstall
  banner
  warn "Entfernt Dienste, Caddy-Konfiguration, Datenbank und .env dieses Panels."
  confirm "Wirklich deinstallieren?" || { info "Abgebrochen."; exit 0; }
  say "Stoppe Dienste..."
  systemctl disable --now "$APP_NAME" network-duckdns.timer network-duckdns.service caddy 2>/dev/null || true
  rm -f "$SERVICE_FILE" "$DUCKDNS_SERVICE" "$DUCKDNS_TIMER" "$CADDY_SERVICE"
  systemctl daemon-reload
  say "Entferne Konfiguration und Daten..."
  rm -rf "$CADDY_DIR/Caddyfile" "$CADDY_DIR/network.env" "$CADDY_DIR/sites.d" "$STATE_DIR"
  rm -rf "$APP_DIR/data" "$APP_DIR/out" "$APP_DIR/.next" "$APP_DIR/dist-server" "$APP_DIR/node_modules" "$ENV_FILE"
  if confirm "Caddy-Binary und Zertifikate (/var/lib/caddy) ebenfalls entfernen?"; then
    rm -f /usr/bin/caddy
    rm -rf /var/lib/caddy
    userdel caddy 2>/dev/null || true
    groupdel caddy 2>/dev/null || true
  fi
  if command -v tailscale >/dev/null 2>&1 && confirm "Tailscale abmelden und deinstallieren?"; then
    tailscale logout 2>/dev/null || true
    apt-get remove -y -qq tailscale >/dev/null 2>&1 || true
  fi
  if confirm "Projektordner ${APP_DIR} komplett loeschen?"; then
    cd /
    rm -rf "$APP_DIR"
  fi
  ok "Deinstallation abgeschlossen."
}

# ----------------------------------------------------------------------------
# 6. INFO / STATUS / LOGS
# ----------------------------------------------------------------------------
service_line() {
  local unit="$1" state pid since mem cpu
  state="$(systemctl is-active "$unit" 2>/dev/null || true)"
  pid="$(systemctl show -p MainPID --value "$unit" 2>/dev/null || echo 0)"
  since="$(systemctl show -p ActiveEnterTimestamp --value "$unit" 2>/dev/null || true)"
  if [ "$state" = "active" ] && [ "${pid:-0}" != "0" ]; then
    mem="$(ps -o rss= -p "$pid" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')"
    cpu="$(ps -o %cpu= -p "$pid" 2>/dev/null | awk '{print $1"%"}')"
    printf "     ${c_green}●${c_reset} %-22s PID %-7s RAM %-9s CPU %-6s seit %s\n" "$unit" "$pid" "$mem" "$cpu" "$since"
  else
    printf "     ${c_red}●${c_reset} %-22s %s\n" "$unit" "${state:-unbekannt}"
  fi
}

cmd_info() {
  banner
  say "Laufzeit"
  info "Node.js : $(node -v 2>/dev/null || echo 'nicht installiert')"
  info "npm     : v$(npm -v 2>/dev/null || echo '-')"
  info "Caddy   : $(caddy version 2>/dev/null | awk '{print $1}' || echo '-')"
  echo
  say "Dienste"
  service_line "$APP_NAME"
  service_line caddy
  service_line network-duckdns.timer
  echo
  say "Netzwerk"
  info "Lokale IP     : $(hostname -I 2>/dev/null | awk '{print $1}')"
  info "Tailscale IP  : $(tailscale ip -4 2>/dev/null | head -n1 || echo 'nicht verbunden')"
  local duck status
  duck="$(env_get DUCKDNS_DOMAIN)"
  info "DuckDNS       : ${duck:-?}.duckdns.org"
  if [ -f "$STATE_DIR/duckdns.json" ]; then
    status="$(jq -r '"\(if .ok then "OK" else "FEHLER" end) · IP \(.ipv4 // "-") · \(.message) · \(.checkedAt)"' "$STATE_DIR/duckdns.json")"
    info "IP-Sync       : ${status}"
  else
    info "IP-Sync       : noch kein Lauf"
  fi
  local resolved
  resolved="$(getent ahostsv4 "${duck}.duckdns.org" 2>/dev/null | awk 'NR==1{print $1}')"
  info "DNS-Aufloesung: ${resolved:-nicht aufloesbar}"
  [ -n "$(env_get CUSTOM_DOMAIN)" ] && info "Eigene Domain : $(env_get CUSTOM_DOMAIN)"
  echo
  say "Repository"
  if git -C "$APP_DIR" rev-parse HEAD >/dev/null 2>&1; then
    info "Branch : $(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)"
    info "Commit : $(git -C "$APP_DIR" log -1 --format='%h %s (%cr)')"
  fi
  echo
}

cmd_status() {
  systemctl --no-pager status "$APP_NAME" caddy network-duckdns.timer || true
}

cmd_logs() {
  local target="${1:-backend}"
  case "$target" in
    caddy) journalctl -u caddy -f -n 100 ;;
    duckdns) journalctl -u network-duckdns.service -f -n 50 ;;
    all) journalctl -u "$APP_NAME" -u caddy -u network-duckdns.service -f -n 100 ;;
    *) journalctl -u "$APP_NAME" -f -n 100 ;;
  esac
}

cmd_duckdns() {
  require_root duckdns
  bash "$APP_DIR/duckdns-update.sh"
}

cmd_help() {
  banner
  cat <<HELP
  Verwendung: ./manage.sh <befehl>

    install      System, Node.js, Caddy (DuckDNS), Tailscale, Build, systemd
    uninstall    Dienste stoppen und alles entfernen (mit Bestaetigung)
    update       git pull, Abhaengigkeiten, Migrationen, Build, Neustart
    info         Versionen, Dienste (PID/RAM/CPU), Netzwerk, DuckDNS, Git
    status       systemctl status aller Dienste
    logs [ziel]  Live-Logs: backend (Standard) | caddy | duckdns | all
    setup        Terminal-Setup-Assistent erneut ausfuehren
    duckdns      DuckDNS-IP sofort aktualisieren

HELP
}

case "${1:-help}" in
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  update) shift; cmd_update "${1:-}" ;;
  info) cmd_info ;;
  status) cmd_status ;;
  logs) shift; cmd_logs "${1:-backend}" ;;
  setup) cmd_setup ;;
  duckdns) cmd_duckdns ;;
  help|-h|--help) cmd_help ;;
  *) cmd_help; exit 1 ;;
esac
