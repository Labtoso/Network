#!/usr/bin/env bash
# Wrapper script for manage.sh (supports ./admin.sh <install|uninstall|update|info|status|logs>)
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${DIR}/manage.sh" "$@"
