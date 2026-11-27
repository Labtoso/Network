#!/usr/bin/env bash
# ============================================================================
# LABTOSO NETWORK - PROXMOX ONE-CLICK INSTALLER
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh)"
#
# Auf dem Proxmox-VE-Host: erstellt einen Debian-12-LXC (unprivilegiert, Nesting),
# fragt die Zugangsdaten ab und installiert alles im Container.
# In einem bestehenden Debian/Ubuntu-System: installiert direkt nach /opt/network.
# ============================================================================
set -Eeuo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8

REPO_URL="${NETWORK_REPO:-https://github.com/Labtoso/Network.git}"
BRANCH="${NETWORK_BRANCH:-main}"
APP_DIR="/opt/network"

c_blue="\033[38;5;39m"; c_green="\033[32m"; c_amber="\033[33m"; c_red="\033[31m"; c_dim="\033[2m"; c_bold="\033[1m"; c_reset="\033[0m"
say()  { printf " ${c_green}==>${c_reset} ${c_bold}%s${c_reset}\n" "$*"; }
info() { printf "     ${c_dim}•${c_reset} %s\n" "$*"; }
warn() { printf " ${c_amber}[!]${c_reset} %s\n" "$*"; }
die()  { printf "\n ${c_red}[✗] %s${c_reset}\n\n" "$*" >&2; exit 1; }
trap 'die "Abbruch in Zeile ${LINENO}: ${BASH_COMMAND}"' ERR

banner() {
  clear || true
  printf "${c_blue}${c_bold}"
  cat <<'ART'
    _   __     __                      __      ____           __        ____
   / | / /__  / /___      ______  ____/ /__   /  _/___  _____/ /_____ _/ / /
  /  |/ / _ \/ __/ | /| / / __ \/ ___/ //_/   / // __ \/ ___/ __/ __ `/ / /
 / /|  /  __/ /_ | |/ |/ / /_/ / /  / ,<    _/ // / / (__  ) /_/ /_/ / / /
/_/ |_/\___/\__/ |__/|__/\____/_/  /_/|_|  /___/_/ /_/____/\__/\__,_/_/_/
ART
  printf "${c_reset}  ${c_dim}Proxmox LXC · DuckDNS + Caddy · AdGuard Admin-Panel${c_reset}\n\n"
}

ask() {
  local var="$1" question="$2" default="${3:-}" secret="${4:-}" answer=""
  if [ -n "$secret" ]; then
    read -r -s -p "  ${question}${default:+ [gesetzt]}: " answer </dev/tty; echo
  else
    read -r -p "  ${question}${default:+ [${default}]}: " answer </dev/tty
  fi
  printf -v "$var" '%s' "${answer:-$default}"
}

[ "$(id -u)" -eq 0 ] || die "Bitte als root ausfuehren."

collect_answers() {
  say "Setup-Assistent"
  info "DuckDNS: Login auf https://www.duckdns.org → Subdomain anlegen → Token kopieren"
  ask DUCK "DuckDNS-Subdomain (z. B. labtoso)" "labtoso"
  DUCK="${DUCK%.duckdns.org}"
  ask DUCK_TOKEN "DuckDNS-Token" "" secret
  [ -n "$DUCK_TOKEN" ] || die "Der DuckDNS-Token ist Pflicht."
  ask CUSTOM "Eigene Backend-Domain als CNAME (optional, z. B. api.labtoso.de)" ""
  echo
  info "Tailscale Auth-Key (optional, Enter = ueberspringen): https://login.tailscale.com/admin/settings/keys"
  ask TS_KEY "Tailscale Auth-Key" "" secret
  echo
  ask AG_URL "AdGuard Home Adresse" "http://192.168.178.50:80"
  ask AG_USER "AdGuard Benutzer" "admin"
  ask AG_PASS "AdGuard Passwort" "" secret
  echo
  info "Google OAuth Client-ID: https://console.cloud.google.com/apis/credentials (Typ Webanwendung)"
  info "Autorisierte JavaScript-Quellen: https://admin.labtoso.de und https://${DUCK}.duckdns.org"
  ask GOOGLE_ID "Google Client-ID" ""
  ask EMAIL "Freigeschaltete Google-Adresse" "sebirauch2022@gmail.com"
  ask CORS "Frontend-Origins (GitHub Pages)" "https://admin.labtoso.de,https://labtoso.github.io"
}

write_env() {
  local target="$1"
  umask 077
  cat >"$target" <<ENV
HOST=127.0.0.1
PORT=8787
DATABASE_URL="file:${APP_DIR}/data/network.db"
DUCKDNS_DOMAIN=${DUCK}
DUCKDNS_TOKEN=${DUCK_TOKEN}
DUCKDNS_IPV6=false
CUSTOM_DOMAIN=${CUSTOM}
PUBLIC_URL=
ACME_EMAIL=${EMAIL}
GOOGLE_CLIENT_ID=${GOOGLE_ID}
ALLOWED_EMAIL=${EMAIL}
SESSION_HOURS=12
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=${CORS}
ADGUARD_URL=${AG_URL%/}
ADGUARD_USER=${AG_USER}
ADGUARD_PASS=${AG_PASS}
FALLBACK_DOH=https://dns.quad9.net/dns-query
DOT_ENABLED=true
DOT_PORT=853
STATIC_DIR=${APP_DIR}/out
DUCKDNS_STATUS_FILE=/var/lib/network-admin/duckdns.json
TS_AUTHKEY=${TS_KEY}
ENV
  umask 022
}

install_local() {
  say "Installiere direkt auf diesem System nach ${APP_DIR}..."
  command -v apt-get >/dev/null 2>&1 || die "Benoetigt Debian/Ubuntu (apt-get)."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl ca-certificates openssl >/dev/null
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" pull --ff-only
  else
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  if [ ! -f "$APP_DIR/.env" ]; then
    collect_answers
    write_env "$APP_DIR/.env"
  fi
  NETWORK_NONINTERACTIVE=1 bash "$APP_DIR/manage.sh" install
}

pick_storage() {
  local content="$1" fallback="$2"
  pvesm status -content "$content" 2>/dev/null | awk 'NR>1 && $3=="active" {print $1}' | head -n1 || echo "$fallback"
}

install_proxmox() {
  say "Proxmox VE erkannt: lege einen Debian-12-LXC an"
  local ctid hostname disk ram cores bridge ipcfg gw rootfs tplstore template
  ctid="$(pvesh get /cluster/nextid)"
  ask ctid "Container-ID" "$ctid"
  pct status "$ctid" >/dev/null 2>&1 && die "CT ${ctid} existiert bereits."
  ask hostname "Hostname" "network"
  ask disk "Disk (GB)" "8"
  ask ram "RAM (MB)" "1024"
  ask cores "CPU-Kerne" "2"
  ask bridge "Netzwerk-Bridge" "vmbr0"
  ask ipcfg "IPv4 (dhcp oder z. B. 192.168.178.60/24)" "dhcp"
  gw=""
  [ "$ipcfg" != "dhcp" ] && ask gw "Gateway" "192.168.178.1"
  rootfs="$(pick_storage rootdir local-lvm)"
  ask rootfs "Storage fuer das Root-Dateisystem" "${rootfs:-local-lvm}"
  tplstore="$(pick_storage vztmpl local)"
  ask tplstore "Storage fuer Templates" "${tplstore:-local}"
  echo
  collect_answers
  echo

  say "Lade Debian-12-Template..."
  pveam update >/dev/null
  template="$(pveam available --section system | awk '/debian-12-standard/ {print $2}' | sort -V | tail -n1)"
  [ -n "$template" ] || die "Kein debian-12-standard Template gefunden."
  pveam list "$tplstore" | grep -q "$template" || pveam download "$tplstore" "$template" >/dev/null

  local net="name=eth0,bridge=${bridge},ip=${ipcfg}"
  [ -n "$gw" ] && net="${net},gw=${gw}"
  say "Erstelle CT ${ctid} (${hostname})..."
  pct create "$ctid" "${tplstore}:vztmpl/${template}" \
    --hostname "$hostname" \
    --cores "$cores" --memory "$ram" --swap 512 \
    --rootfs "${rootfs}:${disk}" \
    --net0 "$net" \
    --unprivileged 1 --features nesting=1,keyctl=1 \
    --onboot 1 --start 0 --ostype debian \
    --description "Labtoso Network Admin-Panel (DuckDNS + Caddy + AdGuard)" >/dev/null

  # TUN-Device fuer Tailscale im unprivilegierten Container
  cat >>"/etc/pve/lxc/${ctid}.conf" <<'TUN'
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
TUN

  pct start "$ctid"
  say "Warte auf Netzwerk im Container..."
  for _ in $(seq 1 60); do
    pct exec "$ctid" -- bash -c "getent hosts deb.debian.org >/dev/null 2>&1" && break
    sleep 2
  done
  pct exec "$ctid" -- bash -c "getent hosts deb.debian.org >/dev/null" || die "Container hat kein Internet."

  say "Installiere Grundpakete und klone das Repository..."
  pct exec "$ctid" -- bash -c "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl ca-certificates openssl locales >/dev/null"
  pct exec "$ctid" -- bash -c "git clone --branch '${BRANCH}' '${REPO_URL}' '${APP_DIR}'"

  local envtmp
  envtmp="$(mktemp)"
  write_env "$envtmp"
  pct push "$ctid" "$envtmp" "${APP_DIR}/.env" --perms 600
  rm -f "$envtmp"

  say "Starte ./manage.sh install im Container (dauert einige Minuten)..."
  pct exec "$ctid" -- bash -c "cd '${APP_DIR}' && NETWORK_NONINTERACTIVE=1 ./manage.sh install"

  local ip
  ip="$(pct exec "$ctid" -- bash -c "hostname -I | awk '{print \$1}'")"
  echo
  printf " ${c_green}${c_bold}Installation abgeschlossen!${c_reset}\n"
  info "Container       : CT ${ctid} (${hostname}) · IP ${ip}"
  info "Panel           : https://${DUCK}.duckdns.org"
  [ -n "$CUSTOM" ] && info "Eigene Domain   : https://${CUSTOM} (CNAME auf ${DUCK}.duckdns.org)"
  info "Panel (Pages)   : ${CORS%%,*}"
  info "Router          : TCP 443 und 853 an ${ip} weiterleiten"
  info "AdGuard         : Einstellungen → DNS → Blockmodus 'Benutzerdefinierte IP' = ${ip}"
  info "AdGuard (DoH)   : in AdGuardHome.yaml 'allow_unencrypted_doh: true' setzen"
  info "Verwaltung      : pct enter ${ctid} → cd ${APP_DIR} && ./manage.sh info"
  echo
}

banner
if command -v pct >/dev/null 2>&1 && command -v pveam >/dev/null 2>&1; then
  install_proxmox
else
  install_local
fi
