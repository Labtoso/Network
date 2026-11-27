#!/usr/bin/env bash
# Labtoso Network Control Suite for Proxmox VE: creates a Debian 12 LXC container and installs the panel inside.
# Run in the Proxmox host shell (Datacenter -> your node -> Shell) as root:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh)"
#   or
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/proxmox.sh)"
#
# Run it again to update an existing Network container (keeps everything) or to create another one.
set -Eeuo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8 LANGUAGE=

REPO_URL="https://github.com/Labtoso/Network.git"
BRANCH="main"
INSTALL_DIR="/opt/network"
TITLE="Labtoso Network Control Suite"
TAG="network-admin"
PUBLIC_DOMAIN="admin.labtoso.de"
ALLOWED_EMAIL="sebirauch2022@gmail.com"

c_ok="\033[32m"; c_err="\033[31m"; c_dim="\033[2m"; c_b="\033[1m"; c_off="\033[0m"
say()  { printf " ${c_ok}✓${c_off} %s\n" "$*"; }
info() { printf " ${c_dim}…${c_off} %s\n" "$*"; }
die()  { printf "\n ${c_err}✗ %s${c_off}\n\n" "$*" >&2; exit 1; }
trap 'die "Failed in line $LINENO: $BASH_COMMAND"' ERR

[ "$(id -u)" -eq 0 ] || die "Please run this as root in the Proxmox host shell (or with sudo on Linux)."
if [ ! -t 0 ] && (exec </dev/tty) 2>/dev/null; then exec </dev/tty; fi

# ---------- Direct Linux / VPS Fallback when not on a Proxmox Host ----------
if ! command -v pveversion >/dev/null 2>&1 || ! command -v pct >/dev/null 2>&1; then
  clear 2>/dev/null || true
  printf "\n  ${c_b}%s${c_off} · Linux / VPS Installer\n\n" "$TITLE"
  info "Installing system packages (curl, wget, git, jq, openssl, ca-certificates, iptables)"
  apt-get update -qq >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl wget git jq openssl ca-certificates gnupg iptables >/dev/null
  say "System packages installed"

  if [ -d "$INSTALL_DIR/.git" ]; then
    git -c safe.directory="$INSTALL_DIR" -C "$INSTALL_DIR" fetch -q --depth 1 origin "$BRANCH"
    git -c safe.directory="$INSTALL_DIR" -C "$INSTALL_DIR" reset -q --hard FETCH_HEAD
  else
    rm -rf "$INSTALL_DIR"
    git clone -q --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  fi
  chmod +x "$INSTALL_DIR/manage.sh" "$INSTALL_DIR/admin.sh" "$INSTALL_DIR/deploy/"*.sh 2>/dev/null || true
  cd "$INSTALL_DIR"
  ./manage.sh install
  exit 0
fi

# ---------- Proxmox VE Host Mode (Just like Labtoso/Bots proxmox.sh) ----------
command -v whiptail >/dev/null || { apt-get update -qq && apt-get install -y -qq whiptail >/dev/null; }

clear 2>/dev/null || true
printf "\n  ${c_b}%s${c_off} · Proxmox LXC installer\n  ${c_dim}%s${c_off}\n\n" "$TITLE" "$(pveversion | cut -d/ -f1-2)"

cancel() { clear 2>/dev/null || true; echo "Cancelled, nothing was changed."; exit 0; }
input()  { whiptail --backtitle "$TITLE" --title "$1" --inputbox "$2" 11 72 "${3:-}" 3>&1 1>&2 2>&3 || cancel; }
secret() { whiptail --backtitle "$TITLE" --title "$1" --passwordbox "$2" 13 74 3>&1 1>&2 2>&3 || cancel; }
yesno()  { whiptail --backtitle "$TITLE" --title "$1" --yesno "$2" 11 72; }
num()    { [[ "$1" =~ ^[0-9]+$ ]] || die "$2 must be a number (got \"$1\")."; }

# ---------- Notes in the Proxmox UI (Exactly like CT 102 Bots Summary -> Notes) ----------
install_notes() {
  cat > /usr/local/bin/network-notes <<'NOTES'
#!/usr/bin/env bash
# Writes the Labtoso Network Control Suite address into the Notes of network-admin containers
# (Proxmox UI: container -> Summary -> Notes). Refreshed every 2 minutes by network-notes.timer.
set -uo pipefail
state=/run/network-notes; mkdir -p "$state"
ids="$*"; [ -n "$ids" ] || ids=$(pct list 2>/dev/null | awk 'NR>1 && $2=="running" {print $1}')
for id in $ids; do
  pct config "$id" 2>/dev/null | grep -qE '^tags:.*\bnetwork-admin\b' || continue
  [ "$(pct status "$id" 2>/dev/null | awk '{print $2}')" = running ] || continue
  ip=$(pct exec "$id" -- hostname -I 2>/dev/null | awk '{print $1}')
  ts_ip=$(pct exec "$id" -- tailscale ip -4 2>/dev/null | head -n1)
  url=$(pct exec "$id" -- sh -c '
    tok=$(grep -m1 "^CLOUDFLARE_TUNNEL_TOKEN=" /opt/network/.env 2>/dev/null | cut -d= -f2-)
    dom=$(grep -m1 "^PUBLIC_DOMAIN=" /opt/network/.env 2>/dev/null | cut -d= -f2-)
    if [ -n "$tok" ] && [ -n "$dom" ]; then
      echo "https://$dom"
    else
      q=$(journalctl -u network-admin-cloudflared -b --no-pager -o cat 2>/dev/null | grep -o "https://[-a-z0-9]*\.trycloudflare\.com" | tail -1)
      [ -n "$q" ] && echo "$q" || echo "http://$(hostname -I 2>/dev/null | awk "{print \$1}"):3000"
    fi
  ' 2>/dev/null)
  echo "$id ${url:-}"
  desc="## 🛡️ Network Control Suite

**Panel-Adresse** (zum Öffnen oder Kopieren, Zero-Trust & AdGuard 1:1 Dashboard):

\`\`\`
${url:-wird noch ermittelt, Panel startet gerade ...}
\`\`\`

- Dashboard: [admin.labtoso.de](https://admin.labtoso.de)
- Direkt im Heimnetz: [http://${ip:-?}:3000](http://${ip:-127.0.0.1}:3000)
- Tailscale-IP: \`${ts_ip:-nicht verbunden}\`
- 5G / Hotspot Roaming-DoH: \`${url:-https://admin.labtoso.de}/api/dns-query/{client_id}\`
- Container-IP: ${ip:-?}

Logs: \`journalctl -u network-admin -f\` (Konsole des Containers) · Update: Proxmox-Script nochmal ausführen (oder automatisch alle 3 Minuten)

_Die Adresse aktualisiert sich hier alle 2 Minuten von selbst (network-notes.timer auf dem Host)._"
  sum=$(printf '%s' "$desc" | md5sum | cut -d' ' -f1)
  [ "$(cat "$state/$id" 2>/dev/null)" = "$sum" ] && continue
  pct set "$id" --description "$desc" && echo "$sum" > "$state/$id"
done
NOTES
  chmod 755 /usr/local/bin/network-notes
  cat > /etc/systemd/system/network-notes.service <<'UNIT'
[Unit]
Description=Write the Labtoso Network address into the container notes

[Service]
Type=oneshot
ExecStart=/usr/local/bin/network-notes
StandardOutput=null
UNIT
  cat > /etc/systemd/system/network-notes.timer <<'UNIT'
[Unit]
Description=Refresh the Labtoso Network container notes every 2 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable -q --now network-notes.timer
}

show_backend() {
  local id="$1" url="" i
  info "Waiting for the Panel address (writing into Proxmox Container Summary -> Notes)"
  for i in $(seq 1 30); do
    url=$(/usr/local/bin/network-notes "$id" | awk '{print $2}')
    [ -n "$url" ] && break
    sleep 2
  done
  rm -f "/run/network-notes/$id"; /usr/local/bin/network-notes "$id" >/dev/null
  echo
  if [ -n "$url" ]; then
    printf "  ${c_b}Panel-Adresse (steht auch in Proxmox unter Container %s -> Summary -> Notes):${c_off}\n\n" "$id"
    printf "    ${c_ok}${c_b}%s${c_off}\n\n" "$url"
  else
    echo "  The panel address shows up in a moment in the container's Notes."
    echo
  fi
  echo "  Always up to date in the Proxmox UI: container $id -> Summary -> Notes."
}

cores_for() { local n; n=$(nproc 2>/dev/null || echo 2); echo $(( n < 2 ? n : 2 )); }

# ---------- Update an existing container ----------
existing=()
while read -r id _ name; do
  [ -n "${id:-}" ] || continue
  if pct config "$id" 2>/dev/null | grep -qE "^tags:.*\b${TAG}\b"; then existing+=("$id" "$name"); fi
done < <(pct list 2>/dev/null | awk 'NR>1 {print $1, $2, $NF}')

if [ "${#existing[@]}" -gt 0 ]; then
  choice=$(whiptail --backtitle "$TITLE" --title "Network Control Suite found" --menu \
    "There is already a Labtoso Network container on this node. What do you want to do?" 15 72 6 \
    "update" "Update the panel in an existing container (keeps all settings)" \
    "new" "Create another Network container" 3>&1 1>&2 2>&3) || cancel
  if [ "$choice" = update ]; then
    if [ "${#existing[@]}" -eq 2 ]; then CT="${existing[0]}"; else
      CT=$(whiptail --backtitle "$TITLE" --title "Update" --menu "Which container?" 15 60 6 "${existing[@]}" 3>&1 1>&2 2>&3) || cancel
    fi
    clear 2>/dev/null || true
    [ "$(pct status "$CT" | awk '{print $2}')" = running ] || { info "Starting container $CT"; pct start "$CT"; sleep 5; }
    want=$(cores_for); cur=$(pct config "$CT" | awk '/^cores:/ {print $2}')
    if [ "${cur:-0}" != "$want" ]; then pct set "$CT" --cores "$want"; say "Container $CT now uses $want CPU cores"; fi
    info "Updating Labtoso Network in container $CT (keeps tokens, SQLite DB & settings)"
    pct exec "$CT" -- bash -c "cd $INSTALL_DIR && ./manage.sh update"
    say "Container $CT is up to date."
    install_notes
    show_backend "$CT"
    echo
    exit 0
  fi
fi

# ---------- Defaults ----------
CTID=$(pvesh get /cluster/nextid)
HN="network-admin"; CORES=$(cores_for); RAM=2048; DISK=8; BRIDGE="vmbr0"; NET="dhcp"; GATE=""; VLAN=""; PW=""
UNPRIV=1; AUTOUPDATE=1; DNS=""; ADGUARD_URL="http://192.168.178.67:3001"

pick_storage() {
  local content="$1" label="$2" list=() n
  while read -r name type _ _ _ avail _; do
    [ -n "${name:-}" ] || continue
    list+=("$name" "$(printf '%-10s %s GB free' "$type" "$((avail / 1024 / 1024))")" "OFF")
  done < <(pvesm status -content "$content" 2>/dev/null | awk 'NR>1 && $3=="active"')
  n=$(( ${#list[@]} / 3 ))
  [ "$n" -gt 0 ] || die "No active storage for $label ($content) found."
  if [ "$n" -eq 1 ]; then echo "${list[0]}"; return; fi
  list[2]="ON"
  whiptail --backtitle "$TITLE" --title "Storage" --radiolist \
    "Where should the $label go? (Space to select)" 16 70 6 "${list[@]}" 3>&1 1>&2 2>&3 || cancel
}

MODE=$(whiptail --backtitle "$TITLE" --title "Labtoso Network on Proxmox" --menu \
  "Creates a Debian 12 LXC container and installs the Zero-Trust Admin Panel, AdGuard 1:1 Mirror, Docker & Tailscale.\n\nDefaults: ID $CTID, $CORES CPU, 2 GB RAM, 8 GB disk, $BRIDGE with DHCP." 16 74 2 \
  "simple" "Use the defaults (recommended)" \
  "advanced" "Choose ID, resources, network and more" 3>&1 1>&2 2>&3) || cancel

if [ "$MODE" = advanced ]; then
  CTID=$(input "Container ID" "Container ID:" "$CTID"); num "$CTID" "Container ID"
  if pct status "$CTID" >/dev/null 2>&1 || qm status "$CTID" >/dev/null 2>&1; then die "ID $CTID is already in use."; fi
  HN=$(input "Hostname" "Hostname:" "$HN")
  CORES=$(input "CPU" "CPU cores:" "$CORES"); num "$CORES" "CPU cores"
  RAM=$(input "RAM" "RAM in MB (2048 recommended for Next.js build):" "$RAM"); num "$RAM" "RAM"
  DISK=$(input "Disk" "Disk size in GB:" "$DISK"); num "$DISK" "Disk size"
  BRIDGE=$(input "Network" "Bridge:" "$BRIDGE")
  NET=$(input "Network" "IPv4: dhcp, or a static address with prefix (e.g. 192.168.178.68/24):" "$NET")
  if [ "$NET" != dhcp ]; then
    [[ "$NET" =~ ^[0-9.]+/[0-9]+$ ]] || die "Static IP needs a prefix, e.g. 192.168.178.68/24."
    GATE=$(input "Network" "Gateway (e.g. 192.168.178.1):" "")
    DNS=$(input "Network" "DNS server (empty = same as the Proxmox host):" "")
  fi
  VLAN=$(input "Network" "VLAN tag (empty = none):" "")
  [ -z "$VLAN" ] || num "$VLAN" "VLAN tag"
  yesno "Container type" "Unprivileged container? (recommended)" || UNPRIV=0
  PW=$(secret "Root password" "Root password for the console (empty = no password, use 'pct enter $CTID'):")
  PUBLIC_DOMAIN=$(input "Zero-Trust Domain" "Cloudflare Zero-Trust domain for the panel:" "$PUBLIC_DOMAIN")
  ADGUARD_URL=$(input "AdGuard Home URL" "Local AdGuard Home address for 1:1 bidirectional sync:" "$ADGUARD_URL")
  yesno "Updates" "Update the panel automatically? (checks GitHub every 15 minutes)" || AUTOUPDATE=0
fi

# ---------- Optional Secrets (Tailscale & Cloudflare Tunnel) ----------
TS_KEY=$(whiptail --backtitle "$TITLE" --title "Tailscale (optional) 1/2" --cancel-button "Skip" --passwordbox \
  "Paste your Tailscale Auth-Key (tskey-auth-...) for direct fallback VPN access.\n\nGet one at: login.tailscale.com/admin/settings/keys\nLeave empty and press Enter to skip (you can run 'tailscale up' later)." 13 74 3>&1 1>&2 2>&3) || TS_KEY=""
TS_KEY="${TS_KEY//[[:space:]]/}"

CF_TOKEN=$(whiptail --backtitle "$TITLE" --title "Cloudflare Tunnel (optional) 2/2" --cancel-button "Skip" --passwordbox \
  "Paste your Cloudflare Zero-Trust Tunnel Token for https://${PUBLIC_DOMAIN}.\n\nGet it at: one.dash.cloudflare.com -> Networks -> Tunnels.\nLeave empty and press Enter to skip (you can add it to /opt/network/.env later)." 13 74 3>&1 1>&2 2>&3) || CF_TOKEN=""
CF_TOKEN="${CF_TOKEN//[[:space:]]/}"

ROOTFS=$(pick_storage rootdir "container disk")
TMPL_STORE=$(pick_storage vztmpl "Debian template")

clear 2>/dev/null || true
printf "\n  ${c_b}%s${c_off}\n\n" "$TITLE"
say "Disk on $ROOTFS, template on $TMPL_STORE"

info "Looking for the Debian 12 template"
pveam update >/dev/null 2>&1 || true
TMPL=$(pveam available --section system 2>/dev/null | awk '{print $2}' | grep -E '^debian-12-standard' | sort -V | tail -1 || true)
[ -n "$TMPL" ] || TMPL=$(pveam available --section system 2>/dev/null | awk '{print $2}' | grep -E '^debian-[0-9]+-standard' | sort -V | tail -1 || true)
[ -n "$TMPL" ] || die "No Debian template found (pveam available). Is the host online?"
if ! pveam list "$TMPL_STORE" 2>/dev/null | grep -q "$TMPL"; then
  info "Downloading $TMPL"
  pveam download "$TMPL_STORE" "$TMPL" >/dev/null
fi
say "Template $TMPL"

net="name=eth0,bridge=$BRIDGE,ip=$NET"
[ -n "$GATE" ] && net="$net,gw=$GATE"
[ -n "$VLAN" ] && net="$net,tag=$VLAN"
opts=(
  --hostname "$HN" --cores "$CORES" --memory "$RAM" --swap 512
  --rootfs "$ROOTFS:$DISK" --net0 "$net" --ostype debian
  --unprivileged "$UNPRIV" --features "nesting=1,keyctl=1" --onboot 1 --tags "$TAG"
  --description "Labtoso Network Control Suite, installing ..."
)
[ -n "$DNS" ] && opts+=(--nameserver "$DNS")
[ -n "$PW" ] && opts+=(--password "$PW")

info "Creating container $CTID"
pct create "$CTID" "$TMPL_STORE:vztmpl/$TMPL" "${opts[@]}" >/dev/null

# Enable /dev/net/tun so Tailscale works inside unprivileged LXC
LXC_CONF="/etc/pve/lxc/${CTID}.conf"
if [ -f "$LXC_CONF" ] && ! grep -q "/dev/net/tun" "$LXC_CONF"; then
  cat >> "$LXC_CONF" <<'TUNEOF'
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
TUNEOF
fi

say "Container $CTID ($HN) created"
pct start "$CTID"

info "Waiting for the network"
for i in $(seq 1 30); do
  pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
  [ "$i" -eq 30 ] && die "The container has no internet connection. Check bridge/IP settings (pct config $CTID)."
  sleep 2
done
say "Network ready"

info "Preparing Debian 12 & syncing host timezone"
pct exec "$CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq >/dev/null && apt-get -y -qq -o Dpkg::Use-Pty=0 upgrade >/dev/null 2>&1 && apt-get install -y -qq -o Dpkg::Use-Pty=0 curl wget git jq openssl ca-certificates gnupg iptables >/dev/null 2>&1"
HOST_TZ=$(cat /etc/timezone 2>/dev/null || timedatectl show -p Timezone --value 2>/dev/null || true)
[ -n "$HOST_TZ" ] && pct exec "$CTID" -- bash -c "ln -sf /usr/share/zoneinfo/$HOST_TZ /etc/localtime && echo $HOST_TZ > /etc/timezone" 2>/dev/null || true
say "Debian up to date"

# Secrets go in via a root-only file, so they never show up in the host process list
tmp=$(mktemp); chmod 600 "$tmp"
printf 'TS_KEY=%q\nCF_TOKEN=%q\nPUBLIC_DOMAIN=%q\nALLOWED_EMAIL=%q\nADGUARD_URL=%q\nAUTOUPDATE=%q\n' \
  "$TS_KEY" "$CF_TOKEN" "$PUBLIC_DOMAIN" "$ALLOWED_EMAIL" "$ADGUARD_URL" "$AUTOUPDATE" > "$tmp"
pct push "$CTID" "$tmp" /root/.network-setup --perms 600
rm -f "$tmp"; unset TS_KEY CF_TOKEN

info "Installing Node.js 22 LTS, Docker, Tailscale, Cloudflared & building Network Control Suite (takes ~2 minutes)"
pct exec "$CTID" -- bash -c '
  set -e
  export DEBIAN_FRONTEND=noninteractive
  . /root/.network-setup; rm -f /root/.network-setup

  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
  npm install -g pnpm --loglevel=error >/dev/null 2>&1 || true

  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || true
  curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1 || true
  systemctl enable -q --now tailscaled 2>/dev/null || true
  [ -n "$TS_KEY" ] && tailscale up --authkey="$TS_KEY" --hostname="'"$HN"'" --accept-routes >/dev/null 2>&1 || true

  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main" > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq >/dev/null && apt-get install -y -qq cloudflared >/dev/null 2>&1 || true

  rm -rf "'"$INSTALL_DIR"'"
  git clone -q --depth 1 --branch "'"$BRANCH"'" "'"$REPO_URL"'" "'"$INSTALL_DIR"'"
  cd "'"$INSTALL_DIR"'"
  cp .env.example .env
  sed -i "s|^PUBLIC_DOMAIN=.*|PUBLIC_DOMAIN=${PUBLIC_DOMAIN}|" .env
  sed -i "s|^NEXT_PUBLIC_DOMAIN=.*|NEXT_PUBLIC_DOMAIN=${PUBLIC_DOMAIN}|" .env
  sed -i "s|^ALLOWED_EMAIL=.*|ALLOWED_EMAIL=${ALLOWED_EMAIL}|" .env
  sed -i "s|^NEXT_PUBLIC_ALLOWED_EMAIL=.*|NEXT_PUBLIC_ALLOWED_EMAIL=${ALLOWED_EMAIL}|" .env
  sed -i "s|^ADGUARD_URL=.*|ADGUARD_URL=${ADGUARD_URL}|" .env
  [ -n "$CF_TOKEN" ] && sed -i "s|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=${CF_TOKEN}|" .env
  chmod 600 .env
  chmod +x manage.sh admin.sh deploy/*.sh 2>/dev/null || true

  ./manage.sh install >/dev/null

  if [ "$AUTOUPDATE" = 1 ]; then
    cp deploy/network-update.service /etc/systemd/system/network-update.service
    cp deploy/network-update.timer /etc/systemd/system/network-update.timer
    systemctl daemon-reload
    systemctl enable -q --now network-update.timer
  fi
'

install_notes
IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')
TS_IP=$(pct exec "$CTID" -- tailscale ip -4 2>/dev/null | head -n1 || true)
NODE_V=$(pct exec "$CTID" -- node -v 2>/dev/null || echo "v22")

echo
printf " ${c_ok}${c_b}Labtoso Network Control Suite läuft in Container %s (Node %s)${c_off}\n" "$CTID" "$NODE_V"
show_backend "$CTID"
echo
[ -n "$IP" ] && echo "  Container IP:  http://$IP:3000"
[ -n "$TS_IP" ] && echo "  Tailscale IP:  http://$TS_IP:3000"
echo "  Owner Policy:  $ALLOWED_EMAIL (Cloudflare Zero Trust · Google OAuth)"
echo
echo "  Info:    pct exec $CTID -- /opt/network/manage.sh info"
echo "  Logs:    pct exec $CTID -- /opt/network/manage.sh logs"
echo "  Shell:   pct enter $CTID"
echo "  Update:  run this script again (or it updates itself every 15 minutes)"
echo "  Remove:  pct stop $CTID && pct destroy $CTID"
echo "           (notes helper on the host: systemctl disable --now network-notes.timer)"
echo
