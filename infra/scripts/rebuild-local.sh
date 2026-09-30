#!/usr/bin/env bash
#
# rebuild-local.sh - stop the running apps, fast-forward the current branch
# from its upstream, rebuild and restart detached. The PostgreSQL container is
# left untouched, so your data survives.
#
# Usage:
#   infra/scripts/rebuild-local.sh                # stop apps, pull, build, start
#   infra/scripts/rebuild-local.sh --no-pull      # skip the git pull
#   infra/scripts/rebuild-local.sh --no-frontend  # forwarded to run-local.sh
#
# Any argument other than --no-pull and --help is forwarded to run-local.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="$ROOT/.run"

# The ports run-local.sh binds on the host.
PORTS=(8080 8081 5173)

info()  { printf '\e[1;36m    %s\e[0m\n' "$*"; }
warn()  { printf '\e[1;33m[warn]\e[0m %s\n' "$*"; }
banner(){ printf '\n\e[1;36m==> %s\e[0m\n' "$*"; }

DO_PULL=true
FORWARD_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=false ;;
    -h|--help)
      awk 'NR>1 { if (/^#/) { sub(/^# ?/, ""); print } else exit }' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) FORWARD_ARGS+=("$arg") ;;
  esac
done

# ---------------------------------------------------------------------------
# 1. Stop running apps
# ---------------------------------------------------------------------------
banner "Stopping running apps"

for pidfile in "$RUN_DIR"/api.pid "$RUN_DIR"/bff.pid "$RUN_DIR"/frontend.pid; do
  if [[ -f "$pidfile" ]]; then
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      info "Stopped pid $pid ($(basename "$pidfile" .pid))"
    fi
    rm -f "$pidfile"
  fi
done

sleep 2

# Anything still holding a port is a leftover from a run whose pid file is gone.
for port in "${PORTS[@]}"; do
  pids="$(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    warn "Port $port still in use (pids: $pids) - stopping"
    echo "$pids" | xargs kill 2>/dev/null || true
  fi
done

sleep 1

for port in "${PORTS[@]}"; do
  if lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    warn "Port $port is still occupied - aborting"
    exit 1
  fi
done
info "All ports free."

# ---------------------------------------------------------------------------
# 2. Update the working tree
# ---------------------------------------------------------------------------
if [[ "$DO_PULL" == true ]]; then
  banner "Pulling the current branch (fast-forward only)"
  git -C "$ROOT" pull --ff-only
else
  banner "Skipping git pull (--no-pull)"
fi

# ---------------------------------------------------------------------------
# 3. Build and start (the database stays up)
# ---------------------------------------------------------------------------
banner "Starting (build + apps)"
exec "$ROOT/infra/scripts/run-local.sh" --detach ${FORWARD_ARGS[@]+"${FORWARD_ARGS[@]}"}
