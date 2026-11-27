#!/usr/bin/env bash
# ============================================================================
# LABTOSO NETWORK CONTROL SUITE - MANAGEMENT CLI (manage.sh)
# Commands: install | uninstall | update | info | status | logs
# ============================================================================
set -Eeuo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8

APP_NAME="network-admin"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
CF_SERVICE_FILE="/etc/systemd/system/${APP_NAME}-cloudflared.service"
PORT="${PORT:-3000}"
DOMAIN="${PUBLIC_DOMAIN:-admin.labtoso.de}"
OWNER_EMAIL="${ALLOWED_EMAIL:-sebirauch2022@gmail.com}"
MIN_NODE_MAJOR=20

c_blue="\033[38;5;39m"
c_cyan="\033[36m"
c_green="\033[32m"
c_amber="\033[33m"
c_red="\033[31m"
c_dim="\033[2m"
c_bold="\033[1m"
c_reset="\033[0m"

banner() {
  printf "${c_blue}${c_bold}"
  cat <<'EOF'
    __          __    __                   _   __     __                      __  
   / /   ____ _/ /_  / /_____  ________   / | / /__  / /___      ______  ____/ /__
  / /   / __ `/ __ \/ __/ __ \/ ___/ __ \/  |/ / _ \/ __/ | /| / / __ \/ ___/ //_/
 / /___/ /_/ / /_/ / /_/ /_/ (__  ) /_/ / /|  /  __/ /_ | |/ |/ / /_/ / /  / ,<   
/_____/\__,_/_.___/\__/\____/____/\____/_/ |_/\___/\__/ |__/|__/\____/_/  /_/|_|  
EOF
  printf "${c_reset}"
  printf "  ${c_dim}Zero-Trust Admin Panel · AdGuard 1:1 Mirror · 5G Anti-Bypass (${DOMAIN})${c_reset}\n\n"
}

say()  { printf " ${c_green}==>${c_reset} ${c_bold}%s${c_reset}\n" "$*"; }
info() { printf "     ${c_dim}•${c_reset} %s\n" "$*"; }
warn() { printf " ${c_amber}[!]${c_reset} %s\n" "$*"; }
die()  { printf "\n ${c_red}[✗] %s${c_reset}\n\n" "$*" >&2; exit 1; }

# ----------------------------------------------------------------------------
# 1. ENVIRONMENT, SYSTEM DEPENDENCIES & ROOT-CA CHECK
# ----------------------------------------------------------------------------
ensure_system_packages() {
  say "Checking & installing system-level dependencies..."
  local pkgs=(curl wget git jq openssl ca-certificates iptables)
  local missing=()
  for p in "${pkgs[@]}"; do
    command -v "$p" >/dev/null 2>&1 || missing+=("$p")
  done

  if [ "${#missing[@]}" -gt 0 ] && [ "$(id -u)" -eq 0 ]; then
    info "Installing missing system packages: ${missing[*]}"
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update -qq >/dev/null
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}" >/dev/null
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y -q "${missing[@]}" >/dev/null
    fi
  fi
  info "System utilities verified: curl, wget, git, jq, openssl, ca-certificates, iptables"

  if ! command -v tailscale >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
    info "Installing Tailscale Mesh VPN daemon..."
    curl -fsSL https://tailscale.com/install.sh | sh >/dev/null 2>&1 || warn "Tailscale install skipped."
  fi
}

check_node_env() {
  say "Checking Node.js, npm, pnpm & Docker runtime environment..."
  local node_major=0
  if command -v node >/dev/null 2>&1; then
    node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  fi

  if [ "$node_major" -lt "$MIN_NODE_MAJOR" ]; then
    warn "Node.js >= v${MIN_NODE_MAJOR} required (found: $(node -v 2>/dev/null || echo 'none'))."
    if [ "$(id -u)" -eq 0 ]; then
      say "Installing Node.js 22 LTS automatically..."
      if command -v apt-get >/dev/null 2>&1; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
      elif command -v dnf >/dev/null 2>&1; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null
        dnf install -y -q nodejs
      else
        die "Automatic Node.js installation requires apt-get or dnf."
      fi
    else
      die "Please run as root (sudo ./manage.sh install) or install Node.js >= v20."
    fi
  fi

  if ! command -v pnpm >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
    npm install -g pnpm --loglevel=error >/dev/null 2>&1 || true
  fi

  if ! command -v docker >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
    info "Installing Docker & Docker Compose plugin..."
    curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || warn "Docker install skipped."
  fi

  info "Node.js Version : $(node -v)"
  info "V8 Engine       : $(node -p 'process.versions.v8')"
  info "npm / pnpm      : npm v$(npm -v 2>/dev/null || echo '?') / pnpm $(pnpm -v 2>/dev/null || echo 'n/a')"
  info "Platform / Arch : $(uname -s -r -m 2>/dev/null || echo 'Linux x64')"
}

ensure_root_ca() {
  say "Checking Local Root-CA (openssl) for Custom HTTPS Block Page..."
  mkdir -p "${APP_DIR}/certs"
  if [ ! -f "${APP_DIR}/certs/labtoso-root-ca.crt" ]; then
    openssl req -x509 -new -nodes -newkey rsa:2048 \
      -keyout "${APP_DIR}/certs/labtoso-root-ca.key" \
      -sha256 -days 3650 \
      -out "${APP_DIR}/certs/labtoso-root-ca.crt" \
      -subj "/C=DE/ST=Home/L=LAN/O=Labtoso Zero-Trust Network/CN=Labtoso Root CA" >/dev/null 2>&1 || true
    chmod 600 "${APP_DIR}/certs/labtoso-root-ca.key" 2>/dev/null || true
    info "Generated new Root-CA: ${APP_DIR}/certs/labtoso-root-ca.crt"
  else
    info "Existing Root-CA found: ${APP_DIR}/certs/labtoso-root-ca.crt"
  fi
}

# ----------------------------------------------------------------------------
# 2. INSTALL COMMAND
# ----------------------------------------------------------------------------
cmd_install() {
  banner
  ensure_system_packages
  check_node_env
  ensure_root_ca

  cd "$APP_DIR"
  source "$APP_DIR/deploy/network-service.sh"
  PORT="$(network_service_port)"
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

  if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    say "Creating .env configuration from .env.example..."
    cp .env.example .env
    chmod 600 .env 2>/dev/null || true
  fi
  if [ -f ".env" ] && ! grep -q "^DATABASE_URL=" .env; then
    echo 'DATABASE_URL="file:./dev.db"' >> .env
  fi

  mkdir -p "${APP_DIR}/data"

  say "Installing project npm dependencies..."
  if [ -f "package-lock.json" ]; then
    npm ci --include=dev --no-audit --no-fund --loglevel=error
  else
    npm install --include=dev --no-audit --no-fund --loglevel=error
  fi

  say "Initializing & migrating SQLite database via Prisma..."
  DATABASE_URL="file:./dev.db" npm run db:generate
  DATABASE_URL="file:./dev.db" npm run db:push

  say "Building production Next.js bundle (npm run build)..."
  npm run build

  # Copy static assets into standalone directory if Next.js standalone mode is active
  if [ -d ".next/standalone" ]; then
    mkdir -p .next/standalone/.next
    cp -r public .next/standalone/ 2>/dev/null || true
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
  fi

  if [ "$(id -u)" -eq 0 ] && command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    say "Configuring systemd service (${APP_NAME}.service)..."
    local start_cmd="/usr/bin/npm run start"
    if [ -f "${APP_DIR}/.next/standalone/server.js" ]; then
      start_cmd="/usr/bin/node ${APP_DIR}/.next/standalone/server.js"
    fi

    cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=Labtoso Zero-Trust Network Control Panel (${DOMAIN})
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
EnvironmentFile=-${APP_DIR}/.env
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=HOSTNAME=0.0.0.0
ExecStart=${start_cmd}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

    systemctl daemon-reload
    systemctl enable -q "$APP_NAME"
    systemctl restart "$APP_NAME"
    wait_for_network_service "$APP_NAME.service" "$PORT"
    info "Systemd service ${APP_NAME}.service started and enabled on boot."

    # Cloudflare Tunnel service: uses CLOUDFLARE_TUNNEL_TOKEN if set, otherwise starts a free Quick Tunnel (trycloudflare.com) just like the Bots repo!
    local cf_token=""
    if [ -f "${APP_DIR}/.env" ]; then
      cf_token="$(grep -E '^CLOUDFLARE_TUNNEL_TOKEN=' "${APP_DIR}/.env" | cut -d= -f2- | tr -d ' "\r' || true)"
    fi
    if command -v cloudflared >/dev/null 2>&1; then
      say "Configuring Cloudflare Tunnel service (${APP_NAME}-cloudflared.service)..."
      local cf_exec="/usr/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:${PORT}"
      if [ -n "$cf_token" ]; then
        cf_exec="/usr/bin/cloudflared tunnel --no-autoupdate run --token ${cf_token}"
      fi
      cat > "$CF_SERVICE_FILE" <<CFUNIT
[Unit]
Description=Cloudflare Tunnel for Labtoso Network Control Suite
After=network-online.target ${APP_NAME}.service

[Service]
Type=simple
User=root
ExecStart=${cf_exec}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
CFUNIT
      systemctl daemon-reload
      systemctl enable -q --now "${APP_NAME}-cloudflared"
      info "Cloudflare Tunnel active (writes live URL into Proxmox Container Notes)."
    fi

    # Enable automatic 3-minute GitHub update timer (preserves all config & setup state)
    if [ "${NETWORK_AUTO_UPDATE:-1}" = 1 ] && [ -f "${APP_DIR}/deploy/network-update.service" ] && [ -f "${APP_DIR}/deploy/network-update.timer" ]; then
      sed "s|/opt/network|${APP_DIR}|g" "${APP_DIR}/deploy/network-update.service" > /etc/systemd/system/network-update.service
      cp "${APP_DIR}/deploy/network-update.timer" /etc/systemd/system/network-update.timer
      chmod +x "${APP_DIR}/deploy/network-update.sh" 2>/dev/null || true
      systemctl daemon-reload
      systemctl enable -q --now network-update.timer
      info "Automatic updates enabled (checks GitHub every 3 minutes, keeps all config)."
    fi
  else
    warn "Systemd not active or not root. Start manually with: npm run start"
  fi

  echo
  cmd_info
}

# ----------------------------------------------------------------------------
# 3. UPDATE COMMAND (PRESERVES ALL CONFIG, DB & SETUP STATE)
# ----------------------------------------------------------------------------
cmd_update() {
  banner
  cd "$APP_DIR"
  NETWORK_DIR="$APP_DIR" bash deploy/network-update.sh
  cmd_info
}

# ----------------------------------------------------------------------------
# 4. UNINSTALL COMMAND
# ----------------------------------------------------------------------------
cmd_uninstall() {
  banner
  printf " ${c_red}${c_bold}WARNING:${c_reset} This will stop all services, remove systemd units/containers,\n"
  printf " and delete the configuration in ${c_bold}%s${c_reset}.\n\n" "$APP_DIR"

  local confirm="n"
  if [ -r /dev/tty ]; then
    printf " Are you sure you want to completely uninstall ${APP_NAME}? [y/N]: " > /dev/tty
    read -r confirm < /dev/tty || true
  fi

  case "$confirm" in
    [yY]|[yY][eE][sS]) ;;
    *) echo " Aborted. Nothing was removed."; exit 0 ;;
  esac

  if command -v systemctl >/dev/null 2>&1; then
    say "Stopping and removing systemd services..."
    systemctl disable --now "$APP_NAME" 2>/dev/null || true
    systemctl disable --now "${APP_NAME}-cloudflared" 2>/dev/null || true
    rm -f "$SERVICE_FILE" "$CF_SERVICE_FILE"
    systemctl daemon-reload 2>/dev/null || true
  fi

  if command -v docker >/dev/null 2>&1 && [ -f "${APP_DIR}/docker-compose.yml" ]; then
    say "Stopping and removing Docker containers..."
    (cd "$APP_DIR" && docker compose down --rmi local --volumes --remove-orphans 2>/dev/null) || true
  fi

  say "Cleaning build artifacts & configuration..."
  rm -rf "${APP_DIR}/.next" "${APP_DIR}/node_modules" "${APP_DIR}/.env"

  printf "\n ${c_green}✓ Uninstall completed cleanly.${c_reset}\n\n"
}

# ----------------------------------------------------------------------------
# 5. INFO COMMAND
# ----------------------------------------------------------------------------
cmd_info() {
  banner
  cd "$APP_DIR"
  git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

  local node_ver npm_ver pnpm_ver git_hash git_branch
  node_ver="$(node -v 2>/dev/null || echo 'not installed')"
  npm_ver="$(npm -v 2>/dev/null || echo 'n/a')"
  pnpm_ver="$(pnpm -v 2>/dev/null || echo 'n/a')"
  git_hash="$(git rev-parse --short HEAD 2>/dev/null || echo 'local')"
  git_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'main')"

  local svc_state="inactive" svc_pid="-" svc_mem="-" svc_cpu="-" svc_uptime="-"
  if command -v systemctl >/dev/null 2>&1 && systemctl is-active "$APP_NAME" >/dev/null 2>&1; then
    svc_state="${c_green}ACTIVE (running)${c_reset}"
    svc_pid="$(systemctl show -p MainPID --value "$APP_NAME" 2>/dev/null || echo '-')"
    if [ "$svc_pid" != "-" ] && [ "$svc_pid" != "0" ] && ps -p "$svc_pid" >/dev/null 2>&1; then
      svc_mem="$(ps -o rss= -p "$svc_pid" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')"
      svc_cpu="$(ps -o %cpu= -p "$svc_pid" 2>/dev/null | awk '{printf "%s%%", $1}')"
      svc_uptime="$(ps -o etime= -p "$svc_pid" 2>/dev/null | xargs)"
    fi
  else
    svc_state="${c_amber}STANDBY / MANUAL${c_reset}"
  fi

  local local_ip ts_ip ts_state cf_state
  local_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [ -n "$local_ip" ] || local_ip="127.0.0.1"

  if command -v tailscale >/dev/null 2>&1; then
    ts_ip="$(tailscale ip -4 2>/dev/null | head -n1 || echo 'not connected')"
    if [ -n "$ts_ip" ] && [ "$ts_ip" != "not connected" ]; then
      ts_state="${c_green}Connected (${ts_ip})${c_reset}"
    else
      ts_state="${c_amber}Installed (awaiting tailscale up)${c_reset}"
    fi
  else
    ts_ip="n/a"
    ts_state="${c_dim}Not installed${c_reset}"
  fi

  if pgrep -x cloudflared >/dev/null 2>&1; then
    cf_state="${c_green}ONLINE -> https://${DOMAIN}${c_reset}"
  else
    cf_state="${c_amber}Standby (https://${DOMAIN})${c_reset}"
  fi

  printf "  ${c_bold}┌────────────────────────────────────────────────────────────────────┐${c_reset}\n"
  printf "  ${c_bold}│ RUNTIME & ENVIRONMENT                                              │${c_reset}\n"
  printf "  ${c_bold}└────────────────────────────────────────────────────────────────────┘${c_reset}\n"
  printf "    • Node.js Version   : ${c_cyan}%s${c_reset} (npm: %s | pnpm: %s)\n" "$node_ver" "$npm_ver" "$pnpm_ver"
  printf "    • Git Commit        : ${c_bold}%s${c_reset} (Branch: %s)\n" "$git_hash" "$git_branch"
  printf "    • Working Directory : %s\n\n" "$APP_DIR"

  printf "  ${c_bold}┌────────────────────────────────────────────────────────────────────┐${c_reset}\n"
  printf "  ${c_bold}│ SERVICE TELEMETRY (${APP_NAME})                                  │${c_reset}\n"
  printf "  ${c_bold}└────────────────────────────────────────────────────────────────────┘${c_reset}\n"
  printf "    • Service Status    : %b\n" "$svc_state"
  printf "    • Process PID       : %s (Uptime: %s)\n" "$svc_pid" "$svc_uptime"
  printf "    • Resource Usage    : RAM %s | CPU %s\n\n" "$svc_mem" "$svc_cpu"

  printf "  ${c_bold}┌────────────────────────────────────────────────────────────────────┐${c_reset}\n"
  printf "  ${c_bold}│ NETWORK, ZERO-TRUST & 5G ROAMING ANTI-BYPASS                       │${c_reset}\n"
  printf "  ${c_bold}└────────────────────────────────────────────────────────────────────┘${c_reset}\n"
  printf "    • Local LAN URL     : http://%s:%s\n" "$local_ip" "$PORT"
  printf "    • Tailscale VPN     : %b\n" "$ts_state"
  printf "    • Cloudflare Tunnel : %b\n" "$cf_state"
  printf "    • Roaming DoH URL   : https://%s/api/dns-query/{client_id}\n" "$DOMAIN"
  printf "    • Android DoT Host  : {client_id}.dot.labtoso.de\n"
  printf "    • Zero-Trust Owner  : ${c_green}%s${c_reset} (Google OAuth Hard-Policy)\n\n" "$OWNER_EMAIL"
}

# ----------------------------------------------------------------------------
# 6. STATUS & LOGS COMMANDS
# ----------------------------------------------------------------------------
cmd_status() {
  cmd_info
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "^${APP_NAME}"; then
    systemctl status "$APP_NAME" --no-pager || true
  fi
}

cmd_logs() {
  banner
  say "Streaming live logs for ${APP_NAME} (Press Ctrl+C to exit)..."
  if command -v journalctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q "^${APP_NAME}"; then
    journalctl -u "$APP_NAME" -u "${APP_NAME}-cloudflared" -f --no-pager
  elif command -v docker >/dev/null 2>&1 && [ -f "${APP_DIR}/docker-compose.yml" ]; then
    (cd "$APP_DIR" && docker compose logs -f --tail=100)
  else
    warn "No active systemd unit or Docker stack found."
  fi
}

# ----------------------------------------------------------------------------
# INTERACTIVE MENU & CLI DISPATCHER
# ----------------------------------------------------------------------------
interactive_menu() {
  banner
  echo "  Select an action:"
  echo "    1) install    - Check Node.js, build project & start services"
  echo "    2) update     - Pull latest Git changes, rebuild & restart"
  echo "    3) info       - Show Node, Service, Tailscale & Cloudflare overview"
  echo "    4) status     - Show detailed systemd / container status"
  echo "    5) logs       - Follow live application & tunnel logs"
  echo "    6) uninstall  - Stop services & clean installation"
  echo "    0) exit"
  echo
  printf "  Choice [1-6]: "
  local choice=""
  read -r choice || true
  case "$choice" in
    1) cmd_install ;;
    2) cmd_update ;;
    3) cmd_info ;;
    4) cmd_status ;;
    5) cmd_logs ;;
    6) cmd_uninstall ;;
    *) exit 0 ;;
  esac
}

case "${1:-}" in
  install)   cmd_install ;;
  uninstall) cmd_uninstall ;;
  update)    cmd_update ;;
  info)      cmd_info ;;
  status)    cmd_status ;;
  logs)      cmd_logs ;;
  "")        interactive_menu ;;
  *)
    echo "Usage: $0 {install|uninstall|update|info|status|logs}"
    exit 1
    ;;
esac
