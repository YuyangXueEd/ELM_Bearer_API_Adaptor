#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  printf '\nInstall Node.js 22 or newer from https://nodejs.org, then run this launcher again.\n'
  exit 1
fi
exec node clients/unix/start-elm.mjs
