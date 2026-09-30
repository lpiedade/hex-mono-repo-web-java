#!/usr/bin/env bash
#
# stop-local.sh - stop the stack started by run-local.sh: the API, the portal
# BFF, the Vite dev server and every compose.yaml container (the `app` profile
# included). Thin wrapper around `run-local.sh --down`.
#
# Every process is stopped from its .run/*.pid file, so this needs none of the
# tooling that started them. The database volume is kept; remove it with
# `docker compose down -v` to start from an empty database.
#
# Usage:
#   infra/scripts/stop-local.sh

set -euo pipefail

exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-local.sh" --down "$@"
