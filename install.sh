#!/usr/bin/env bash
# ============================================================================
# LABTOSO NETWORK CONTROL SUITE - PROXMOX VE 1-COMMAND LXC AUTO-INSTALLER
# Run in the Proxmox VE Host Shell as root:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Labtoso/Network/main/install.sh)"
# ============================================================================
set -Eeuo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8 LANGUAGE=

REPO_URL="https://github.com/Labtoso/Network.git"
BRANCH="main"
INSTALL_DIR="/opt/network"
TITLE="Labtoso Network Control Panel"
TAG="network-admin"
PUBLIC_DOMAIN="admin.labtoso.de"
ALLOWED_EMAIL="sebirauch2022@gmail.com"

c_blue="\033[38;5;39m"
c_ok="\033[32m"
c_err="\033[31m"
c_dim="\033[2m"
c_b="\033[1m"
c_off="\033[0m"

say()  { printf " ${c_ok}✓${c_off} %s\n" "$*"; }
info() { printf " ${c_dim}…${c_off} %s\n" "$*"; }
die()  { printf "\n ${c_err}✗ %s${c_off}\n\n" "$*" >&2; exit 1; }
trap 'die "Failed in line $LINENO: $BASH_COMMAND"' ERR

banner() {
  clear 2>/dev/null || true
  printf "${c_blue}${c_b}"
  cat <<'EOF'
    __          __    __                   _   __     __                      __  
   / /   ____ _/ /_  / /_____  ________   / | / /__  / /___      ______  ____/ /__
  / /   / __ `/ __ \/ __/ __ \/ ___/ __ \/  |/ / _ \/ __/ | /| / / __ \/ ___/ //_/
 / /___/ /_/ / /_/ / /_/ /_/ (__  ) /_/ / /|  /  __/ /_ | |/ |/ / /_/ / /  / ,<   
/_____/\__,_/_.___/\__/\____/____/\____/_/ |_/\___/\__/ |__/|__/\____/_/  /_/|_|  
EOF
  printf "${c_off}\n"
}

[ "$(id -u)" -eq 0 ] || die "Please run this script as root."
if [ ! -t 0 ] && (exec </dev/tty) 2>/dev/null; then exec </dev/tty; fi

# ----------------------------------------------------------------------------
# CASE A: RUNNING INSIDE AN EXISTING DEBIAN/UBUNTU CONTAINER OR VPS
# ----------------------------------------------------------------------------
if ! command -v pveversion >/dev/null 2>&1 || ! command -v pct >/dev/null 2>&1; then
  banner
  printf "  ${c_b}%s${c_off} · Direct Linux Server / LXC Guest Installer\n\n" "$TITLE"

  info "Installing base packages (curl, wget, git, jq, openssl, ca-certificates, iptables)..."
  apt-get update -qq >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl wget git jq openssl ca-certificates gnupg iptables >/dev/null
  say "Base system packages ready"

  if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 20 ]; then
    info "Installing Node.js 22 LTS & pnpm..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
  fi
  npm install -g pnpm --loglevel=error >/dev/null 2>&1 || true
  say "Node.js $(node -v) & npm $(npm -v) installed"

  if ! command -v docker >/dev/null 2>&1; then
    info "Installing Docker & Docker Compose..."
    curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || true
    say "Docker engine ready"
  fi

  if ! command -v tailscale >/dev/null 2>&1; then
    info "Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1 || true
    say "Tailscale ready"
  fi

  if ! command -v cloudflared >/dev/null 2>&1; then
    info "Installing Cloudflared..."
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main" > /etc/apt/sources.list.d/cloudflared.list
    apt-get update -qq >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq cloudflared >/dev/null || true
    say "Cloudflared installed"
  fi

  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing repository in $INSTALL_DIR..."
    git -c safe.directory=* -C "$INSTALL_DIR" fetch -q origin "$BRANCH"
    git -c safe.directory=* -C "$INSTALL_DIR" reset -q --hard FETCH_HEAD
  else
    info "Cloning $REPO_URL into $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
    git clone -q --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  fi

  chmod +x "$INSTALL_DIR/manage.sh" "$INSTALL_DIR/admin.sh"
  cd "$INSTALL_DIR"
  ./manage.sh install
  exit 0
fi

# ----------------------------------------------------------------------------
# CASE B: RUNNING ON A PROXMOX VE HOST SHELL (CREATES DEBIAN 12 LXC)
# ----------------------------------------------------------------------------
command -v whiptail >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq whiptail >/dev/null; }

banner
printf "  ${c_b}%s${c_off} · Proxmox VE LXC Auto-Installer\n" "$TITLE"
printf "  ${c_dim}%s${c_off}\n\n" "$(pveversion | cut -d/ -f1-2)"

cancel() { clear 2>/dev/null || true; echo "Cancelled, nothing was changed."; exit 0; }
input()  { whiptail --backtitle "$TITLE" --title "$1" --inputbox "$2" 11 72 "${3:-}" 3>&1 1>&2 2>&3 || cancel; }
secret() { whiptail --backtitle "$TITLE" --title "$1" --passwordbox "$2" 13 74 3>&1 1>&2 2>&3 || cancel; }
yesno()  { whiptail --backtitle "$TITLE" --title "$1" --yesno "$2" 11 72; }
num()    { [[ "$1" =~ ^[0-9]+$ ]] || die "$2 must be a number (got \"$1\")."; }

# ---------- Existing Container Update Check ----------
existing=()
while read -r id _ name; do
  [ -n "${id:-}" ] || continue
  if pct config "$id" 2>/dev/null | grep -q "^tags:.*${TAG}"; then
    existing+=("$id" "$name")
  fi
done < <(pct list 2>/dev/null | awk 'NR>1 {print $1, $2, $NF}')

if [ "${#existing[@]}" -gt 0 ]; then
  choice=$(whiptail --backtitle "$TITLE" --title "Existing Container Found" --menu \
    "A Labtoso Network Admin container already exists on this Proxmox node." 15 72 4 \
    "update" "Update the Admin Panel in the existing container" \
    "new" "Create a new separate LXC container" 3>&1 1>&2 2>&3) || cancel
  if [ "$choice" = "update" ]; then
    CT="${existing[0]}"
    [ "$(pct status "$CT" | awk '{print $2}')" = "running" ] || { info "Starting container $CT"; pct start "$CT"; sleep 4; }
    info "Updating Labtoso Network Control Panel in CT $CT..."
    pct exec "$CT" -- bash -c "cd $INSTALL_DIR && ./manage.sh update"
    say "Container $CT updated successfully!"
    exit 0
  fi
fi

# ---------- Container Defaults ----------
CTID=$(pvesh get /cluster/nextid)
HOST_CORES=$(nproc 2>/dev/null || echo 2)
WANT_CORES=$(( HOST_CORES < 2 ? HOST_CORES : 2 ))
HN="network-admin"
CORES=$WANT_CORES
RAM=2048
DISK=8
BRIDGE="vmbr0"
NET="dhcp"
GATE=""
DNS=""
VLAN=""
UNPRIV=1
PW=""

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
  whiptail --backtitle "$TITLE" --title "Storage Selection" --radiolist \
    "Select storage for $label (Space to select):" 16 72 6 "${list[@]}" 3>&1 1>&2 2>&3 || cancel
}

MODE=$(whiptail --backtitle "$TITLE" --title "Labtoso Network on Proxmox VE" --menu \
  "Creates an unprivileged Debian 12 LXC container (Nesting enabled) and installs the Zero-Trust Admin Panel, Docker, Tailscale & Cloudflared.\n\nDefaults: ID $CTID, $CORES vCPU, ${RAM} MB RAM, ${DISK} GB Disk, $BRIDGE (DHCP)." 17 74 2 \
  "simple" "Standard Installation (Recommended)" \
  "advanced" "Customize Container ID, CPU, RAM, Static IP & VLAN" 3>&1 1>&2 2>&3) || cancel

if [ "$MODE" = "advanced" ]; then
  CTID=$(input "Container ID" "LXC Container ID:" "$CTID"); num "$CTID" "Container ID"
  if pct status "$CTID" >/dev/null 2>&1 || qm status "$CTID" >/dev/null 2>&1; then die "ID $CTID is already in use."; fi
  HN=$(input "Hostname" "Container Hostname:" "$HN")
  CORES=$(input "CPU Cores" "Number of vCPU cores:" "$CORES"); num "$CORES" "CPU cores"
  RAM=$(input "Memory" "RAM in MB:" "$RAM"); num "$RAM" "RAM"
  DISK=$(input "Disk Size" "Root disk size in GB:" "$DISK"); num "$DISK" "Disk size"
  BRIDGE=$(input "Network Bridge" "Bridge interface:" "$BRIDGE")
  NET=$(input "IPv4 Network" "Enter 'dhcp' or static CIDR (e.g. 192.168.178.68/24):" "$NET")
  if [ "$NET" != "dhcp" ]; then
    GATE=$(input "Gateway" "IPv4 Gateway (e.g. 192.168.178.1):" "")
    DNS=$(input "DNS Server" "DNS Server (e.g. 192.168.178.67 for AdGuard Home):" "")
  fi
  VLAN=$(input "VLAN" "VLAN Tag (leave empty for none):" "")
  yesno "Unprivileged LXC" "Create as unprivileged container with nesting=1? (Recommended)" || UNPRIV=0
  PW=$(secret "Root Password" "Optional root password for console login (empty = use 'pct enter $CTID'):")
fi

# ---------- Interactive Prompts for Tailscale & Cloudflare Tunnel ----------
TS_KEY=$(whiptail --backtitle "$TITLE" --title "1/2 · Tailscale Auth-Key" --cancel-button "Skip" --passwordbox \
  "Paste your Tailscale Auth-Key (e.g. tskey-auth-...).\n\nGenerate one at: login.tailscale.com/admin/settings/keys\n(Leave empty and press Enter to authenticate manually later)." 13 74 3>&1 1>&2 2>&3) || TS_KEY=""
TS_KEY="${TS_KEY//[[:space:]]/}"

CF_TOKEN=$(whiptail --backtitle "$TITLE" --title "2/2 · Cloudflare Tunnel Token" --cancel-button "Skip" --passwordbox \
  "Paste your Cloudflare Zero-Trust Tunnel Token for https://${PUBLIC_DOMAIN}.\n\nFind it in Cloudflare One -> Networks -> Tunnels.\n(Leave empty to configure later in /opt/network/.env)." 13 74 3>&1 1>&2 2>&3) || CF_TOKEN=""
CF_TOKEN="${CF_TOKEN//[[:space:]]/}"

ROOTFS=$(pick_storage rootdir "container root disk")
TMPL_STORE=$(pick_storage vztmpl "Debian 12 template")

banner
say "Selected Storage: RootFS on '$ROOTFS', Template on '$TMPL_STORE'"

# ---------- Debian 12 Template ----------
info "Checking Debian 12 LXC template..."
pveam update >/dev/null 2>&1 || true
TMPL=$(pveam available --section system 2>/dev/null | awk '{print $2}' | grep -E '^debian-12-standard' | sort -V | tail -1 || true)
[ -n "$TMPL" ] || die "Could not find debian-12-standard template via pveam."
if ! pveam list "$TMPL_STORE" 2>/dev/null | grep -q "$TMPL"; then
  info "Downloading $TMPL..."
  pveam download "$TMPL_STORE" "$TMPL" >/dev/null
fi
say "Template ready: $TMPL"

# ---------- Create LXC Container ----------
net_str="name=eth0,bridge=${BRIDGE},ip=${NET}"
[ -n "$GATE" ] && net_str="${net_str},gw=${GATE}"
[ -n "$VLAN" ] && net_str="${net_str},tag=${VLAN}"

pct_opts=(
  --hostname "$HN"
  --cores "$CORES"
  --memory "$RAM"
  --swap 512
  --rootfs "${ROOTFS}:${DISK}"
  --net0 "$net_str"
  --ostype debian
  --unprivileged "$UNPRIV"
  --features "nesting=1,keyctl=1"
  --onboot 1
  --tags "$TAG"
  --description "Labtoso Zero-Trust Network Control Center (${PUBLIC_DOMAIN})"
)
[ -n "$DNS" ] && pct_opts+=(--nameserver "$DNS")
[ -n "$PW" ] && pct_opts+=(--password "$PW")

# Enable /dev/net/tun inside LXC so Tailscale WireGuard works out of the box
info "Creating Debian 12 LXC container $CTID ($HN)..."
pct create "$CTID" "${TMPL_STORE}:vztmpl/${TMPL}" "${pct_opts[@]}" >/dev/null

LXC_CONF="/etc/pve/lxc/${CTID}.conf"
if [ -f "$LXC_CONF" ] && ! grep -q "/dev/net/tun" "$LXC_CONF"; then
  cat >> "$LXC_CONF" <<'TUNEOF'
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
TUNEOF
fi

pct start "$CTID"
say "Container $CTID started (Unprivileged=$UNPRIV, Nesting=1, TUN enabled)"

info "Waiting for container network connectivity..."
for i in $(seq 1 30); do
  pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
  [ "$i" -eq 30 ] && die "Container $CTID has no internet connectivity. Check bridge/IP settings."
  sleep 2
done
say "Network online inside container $CTID"

# ---------- Push Secrets via Root-Only File ----------
tmp_sec=$(mktemp)
chmod 600 "$tmp_sec"
printf 'TS_KEY=%q\nCF_TOKEN=%q\nPUBLIC_DOMAIN=%q\nALLOWED_EMAIL=%q\n' \
  "$TS_KEY" "$CF_TOKEN" "$PUBLIC_DOMAIN" "$ALLOWED_EMAIL" > "$tmp_sec"
pct push "$CTID" "$tmp_sec" /root/.network-setup --perms 600
rm -f "$tmp_sec"
unset TS_KEY CF_TOKEN

# ---------- Provision Node.js LTS, Git, Docker, Tailscale & Network Repo ----------
info "Installing Node.js 22 LTS, Git, Docker, Tailscale & Cloudflared in CT $CTID..."
pct exec "$CTID" -- bash -c '
  set -e
  export DEBIAN_FRONTEND=noninteractive
  . /root/.network-setup
  rm -f /root/.network-setup

  apt-get update -qq >/dev/null
  apt-get -y -qq -o Dpkg::Use-Pty=0 upgrade >/dev/null 2>&1
  apt-get install -y -qq -o Dpkg::Use-Pty=0 curl wget git jq openssl ca-certificates gnupg apt-transport-https iptables >/dev/null 2>&1

  # 1. Node.js 22 LTS & pnpm
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
  npm install -g pnpm --loglevel=error >/dev/null 2>&1 || true

  # 2. Docker & Docker Compose
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || true

  # 3. Tailscale
  curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1 || true
  systemctl enable -q --now tailscaled 2>/dev/null || true
  if [ -n "$TS_KEY" ]; then
    tailscale up --authkey="$TS_KEY" --hostname="'"$HN"'" --accept-routes >/dev/null 2>&1 || true
  fi

  # 4. Cloudflared
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main" > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq >/dev/null && apt-get install -y -qq cloudflared >/dev/null 2>&1 || true

  # 5. Clone Labtoso/Network & configure .env
  rm -rf "'"$INSTALL_DIR"'"
  git clone -q --depth 1 --branch "'"$BRANCH"'" "'"$REPO_URL"'" "'"$INSTALL_DIR"'"
  cd "'"$INSTALL_DIR"'"
  cp .env.example .env
  sed -i "s|^PUBLIC_DOMAIN=.*|PUBLIC_DOMAIN=${PUBLIC_DOMAIN}|" .env
  sed -i "s|^NEXT_PUBLIC_DOMAIN=.*|NEXT_PUBLIC_DOMAIN=${PUBLIC_DOMAIN}|" .env
  sed -i "s|^ALLOWED_EMAIL=.*|ALLOWED_EMAIL=${ALLOWED_EMAIL}|" .env
  sed -i "s|^NEXT_PUBLIC_ALLOWED_EMAIL=.*|NEXT_PUBLIC_ALLOWED_EMAIL=${ALLOWED_EMAIL}|" .env
  [ -n "$CF_TOKEN" ] && sed -i "s|^CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=${CF_TOKEN}|" .env
  chmod 600 .env
  chmod +x manage.sh admin.sh

  # 6. Run ./manage.sh install
  ./manage.sh install
'

say "Provisioning and build inside CT $CTID complete!"

# ---------- Gather Final Telemetry & Write Proxmox Container Notes ----------
LOCAL_IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')
TS_IP=$(pct exec "$CTID" -- tailscale ip -4 2>/dev/null | head -n1 || echo "pending")
NODE_V=$(pct exec "$CTID" -- node -v 2>/dev/null || echo "v22.x")
NPM_V=$(pct exec "$CTID" -- npm -v 2>/dev/null || echo "10.x")

NOTES_MD="## 🛡️ Labtoso Network Control Center

- **Zero-Trust Public URL:** [https://${PUBLIC_DOMAIN}](https://${PUBLIC_DOMAIN})
- **Protected Owner Account:** \`${ALLOWED_EMAIL}\` (Cloudflare Access · Google OAuth)
- **Local LAN Address:** \`http://${LOCAL_IP:-127.0.0.1}:3000\`
- **Tailscale Mesh IP:** \`http://${TS_IP:-pending}:3000\`
- **Runtime:** Node.js \`${NODE_V}\` · npm \`${NPM_V}\`
- **Manage CLI:** \`pct exec ${CTID} -- /opt/network/manage.sh info\`"

pct set "$CTID" --description "$NOTES_MD" >/dev/null 2>&1 || true

echo
printf "  ${c_ok}${c_b}┌──────────────────────────────────────────────────────────────────────┐${c_off}\n"
printf "  ${c_ok}${c_b}│ ✓ LABTOSO NETWORK CONTROL CENTER SUCCESSFULLY DEPLOYED               │${c_off}\n"
printf "  ${c_ok}${c_b}└──────────────────────────────────────────────────────────────────────┘${c_off}\n"
printf "    • Proxmox LXC Container : ${c_b}CT %s (%s)${c_off}\n" "$CTID" "$HN"
printf "    • Node.js Environment   : ${c_b}Node %s (npm %s)${c_off}\n" "$NODE_V" "$NPM_V"
printf "    • Local LAN Access      : ${c_ok}http://%s:3000${c_off}\n" "${LOCAL_IP:-127.0.0.1}"
printf "    • Tailscale Fallback    : ${c_ok}http://%s:3000${c_off}\n" "${TS_IP:-awaiting-auth}"
printf "    • Zero-Trust Public URL : ${c_ok}${c_b}https://%s${c_off}\n" "$PUBLIC_DOMAIN"
printf "    • Hard Access Policy    : ${c_b}%s${c_off}\n\n" "$ALLOWED_EMAIL"
printf "    • Management CLI        : ${c_dim}pct exec %s -- /opt/network/manage.sh info${c_off}\n" "$CTID"
printf "    • Live Logs             : ${c_dim}pct exec %s -- /opt/network/manage.sh logs${c_off}\n\n" "$CTID"
