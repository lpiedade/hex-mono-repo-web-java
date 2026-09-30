#!/usr/bin/env bash
#
# e2e.sh - run the Playwright journey suite against the real stack (ADR-014).
#
# Mocked HTTP does not count as browser acceptance: the suite has to prove the
# SPA, the BFF, the API and PostgreSQL answer together. This script brings that
# stack up, points Playwright at it, and tears it down.
#
# It reuses run-local.sh (PostgreSQL in Compose, the API in dev-token mode and
# the BFF in dev mode on the host) rather than duplicating the boot sequence, so
# there is one description of how the system starts and both paths exercise it.
#
# The browser loads the production bundle: the SPA is built and served with
# `vite preview` on :4173, which inherits the dev server's proxy and forwards
# /app/bff, /app/health and /app/about to the BFF on :8081 (ADR-017).
#
# Usage:
#   infra/scripts/e2e.sh              # build, start the stack, run the journey suite
#   infra/scripts/e2e.sh --no-build   # reuse existing exec jars
#   infra/scripts/e2e.sh --keep-up    # leave the stack running afterwards
#
# Exit code is Playwright's, so CI fails when a journey fails.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/portal/web"
RUN_DIR="$REPO_ROOT/.run"

PREVIEW_PORT=4173
BFF_HEALTH="http://localhost:8081/app/health"
BASE_URL="http://localhost:$PREVIEW_PORT/app/"

KEEP_UP=0
RUN_LOCAL_ARGS=(--no-frontend --detach)

for arg in "$@"; do
  case "$arg" in
    --no-build) RUN_LOCAL_ARGS+=(--no-build) ;;
    --keep-up)  KEEP_UP=1 ;;
    -h|--help)  awk 'NR>1 { if (/^#/) { sub(/^# ?/, ""); print } else exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

wait_for_http() {
  local url="$1" tries="${2:-60}"
  for _ in $(seq 1 "$tries"); do
    curl -fsS -o /dev/null "$url" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

stop_preview() {
  local file="$RUN_DIR/preview.pid"
  if [[ -f "$file" ]]; then
    local pid; pid="$(cat "$file")"
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
    rm -f "$file"
  fi
}

cleanup() {
  if [[ "$KEEP_UP" -eq 0 ]]; then
    echo "==> Stopping the stack"
    stop_preview
    "$REPO_ROOT/infra/scripts/stop-local.sh" || true
  else
    echo "==> Leaving the stack up (--keep-up): SPA at $BASE_URL"
    echo "    stop it with infra/scripts/stop-local.sh and: kill \$(cat $RUN_DIR/preview.pid)"
  fi
}
trap cleanup EXIT

echo "==> Starting PostgreSQL, the API and the BFF"
"$REPO_ROOT/infra/scripts/run-local.sh" "${RUN_LOCAL_ARGS[@]}"

# Fail loudly rather than letting Playwright report a suite of navigation errors
# whose cause is "the stack never came up".
curl -fsS -o /dev/null "$BFF_HEALTH" || {
  echo "The BFF is not answering at $BFF_HEALTH" >&2
  exit 1
}

echo "==> Building the SPA"
cd "$FRONTEND_DIR"
[[ -d node_modules ]] || npm ci
npm run build

echo "==> Serving the SPA with vite preview on :$PREVIEW_PORT"
mkdir -p "$RUN_DIR"
npx vite preview --port "$PREVIEW_PORT" --strictPort > "$RUN_DIR/preview.log" 2>&1 &
echo $! > "$RUN_DIR/preview.pid"
wait_for_http "$BASE_URL" || {
  echo "vite preview did not come up at $BASE_URL - see $RUN_DIR/preview.log" >&2
  exit 1
}

echo "==> Running the journey suite against $BASE_URL"
E2E_BASE_URL="$BASE_URL" npx playwright test --project=journey
