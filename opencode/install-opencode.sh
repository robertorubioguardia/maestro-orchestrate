#!/bin/sh
# Install Maestro into opencode from this checkout (or an unpacked package).
# Thin wrapper around scripts/install-opencode-plugin.js; all flags pass through
# (--global, --project, --config-dir <dir>, --uninstall, --force, --dry-run, --help).
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
INSTALLER="$SCRIPT_DIR/../scripts/install-opencode-plugin.js"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node (>= 20) is required but was not found in PATH" >&2
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "error: node >= 20 is required (found $(node -v))" >&2
  exit 1
fi

if [ ! -f "$INSTALLER" ]; then
  echo "error: installer not found at $INSTALLER" >&2
  exit 1
fi

exec node "$INSTALLER" "$@"
