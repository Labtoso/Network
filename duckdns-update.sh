#!/usr/bin/env bash
# ============================================================================
# DuckDNS Auto-Updater: haelt <subdomain>.duckdns.org auf der aktuellen
# oeffentlichen IP. Laeuft per systemd-Timer alle 5 Minuten (network-duckdns.timer).
# Ergebnis landet als JSON in /var/lib/network-admin/duckdns.json fuer das Panel.
# ============================================================================
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
STATUS_DIR="/var/lib/network-admin"
STATUS_FILE="${DUCKDNS_STATUS_FILE:-${STATUS_DIR}/duckdns.json}"

read_env() {
  local key="$1"
  [ -f "$ENV_FILE" ] || return 0
  { grep -E "^${key}=" "$ENV_FILE" || true; } | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}

DUCKDNS_DOMAIN="${DUCKDNS_DOMAIN:-$(read_env DUCKDNS_DOMAIN)}"
DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-$(read_env DUCKDNS_TOKEN)}"
DUCKDNS_IPV6="${DUCKDNS_IPV6:-$(read_env DUCKDNS_IPV6)}"
DUCKDNS_DOMAIN="${DUCKDNS_DOMAIN%.duckdns.org}"

mkdir -p "$(dirname "$STATUS_FILE")"

write_status() {
  local ok="$1" ipv4="$2" ipv6="$3" changed="$4" message="$5"
  local tmp
  tmp="$(mktemp "${STATUS_FILE}.XXXX")"
  jq -n \
    --argjson ok "$ok" \
    --arg ipv4 "$ipv4" \
    --arg ipv6 "$ipv6" \
    --argjson changed "$changed" \
    --arg message "$message" \
    --arg checkedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ok:$ok, ipv4:$ipv4, ipv6:$ipv6, changed:$changed, message:$message, checkedAt:$checkedAt}' >"$tmp"
  chmod 644 "$tmp"
  mv "$tmp" "$STATUS_FILE"
}

if [ -z "$DUCKDNS_DOMAIN" ] || [ -z "$DUCKDNS_TOKEN" ]; then
  write_status false "" "" false "DUCKDNS_DOMAIN oder DUCKDNS_TOKEN fehlt in ${ENV_FILE}."
  echo "DuckDNS: Domain oder Token fehlt." >&2
  exit 1
fi

ipv6=""
if [ "${DUCKDNS_IPV6,,}" = "true" ]; then
  ipv6="$(curl -6 -fsS --max-time 8 https://api6.ipify.org 2>/dev/null || true)"
fi

# verbose=true liefert: OK|KO, IPv4, IPv6, UPDATED|NOCHANGE (je eine Zeile)
url="https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&verbose=true"
[ -n "$ipv6" ] && url="${url}&ipv6=${ipv6}"

if ! response="$(curl -fsS --max-time 20 --retry 2 "$url" 2>&1)"; then
  write_status false "" "$ipv6" false "DuckDNS nicht erreichbar: ${response//$'\n'/ }"
  echo "DuckDNS nicht erreichbar: $response" >&2
  exit 1
fi

mapfile -t lines <<<"$response"
state="${lines[0]:-KO}"
ipv4="${lines[1]:-}"
reported_v6="${lines[2]:-$ipv6}"
change="${lines[3]:-}"

if [ "$state" = "OK" ]; then
  changed=false
  [ "$change" = "UPDATED" ] && changed=true
  write_status true "$ipv4" "$reported_v6" "$changed" "$( [ "$changed" = true ] && echo "IP aktualisiert" || echo "IP unveraendert" )"
  echo "DuckDNS OK: ${DUCKDNS_DOMAIN}.duckdns.org -> ${ipv4} (${change:-?})"
else
  write_status false "" "$reported_v6" false "DuckDNS meldet KO (Domain oder Token falsch?)."
  echo "DuckDNS meldet KO. Domain/Token pruefen." >&2
  exit 1
fi
