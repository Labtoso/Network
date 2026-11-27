#!/usr/bin/env bash

network_service_port() {
  local port="${PORT:-3000}"
  if [ -f .env ]; then
    local configured
    configured="$(sed -nE 's/^PORT=[[:space:]"]*([0-9]+)[[:space:]"]*$/\1/p' .env | tail -n 1)"
    port="${configured:-$port}"
  fi
  printf '%s\n' "$port"
}

wait_for_network_service() {
  local service="$1" port="$2" attempt
  for attempt in {1..20}; do
    if systemctl is-active --quiet "$service" &&
      curl --noproxy '*' --fail --silent --max-time 2 --output /dev/null "http://127.0.0.1:$port/"; then
      return 0
    fi
    sleep 1
  done
  printf 'Panel did not respond on port %s. Check journalctl -u %s.\n' "$port" "$service" >&2
  return 1
}
