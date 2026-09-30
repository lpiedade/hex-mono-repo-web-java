#!/usr/bin/env bash
#
# seed-dev-data.sh - load infra/test-fixtures/dev-data into a running API, through
# the API (infra/test-fixtures/README.md).
#
# Every entry is POSTed as a client would send it, so it passes the contract's and
# the domain's validation. A 409 means the entry is already there, which makes the
# script safe to run again.
#
# Usage:
#   infra/scripts/seed-dev-data.sh                       # API on :8080, token from .run/dev-token
#   APP_API_URL=http://host:8080 APP_API_TOKEN=... infra/scripts/seed-dev-data.sh
#
# Needs: curl, jq.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATA_DIR="$ROOT/infra/test-fixtures/dev-data"
API_URL="${APP_API_URL:-http://localhost:8080}"
TOKEN="${APP_API_TOKEN:-${APP_AUTH_DEV_TOKEN:-}}"

case "${1:-}" in
  -h|--help) awk 'NR>1 { if (/^#/) { sub(/^# ?/, ""); print } else exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
esac

if [[ -z "$TOKEN" && -f "$ROOT/.run/dev-token" ]]; then
  TOKEN="$(cat "$ROOT/.run/dev-token")"
fi
[[ -n "$TOKEN" ]] || { echo "No token: set APP_API_TOKEN or start the stack with run-local.sh" >&2; exit 2; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 2; }

# post <path> <file>: one request per array element; prints a summary line.
post() {
  local path="$1" file="$2" created=0 present=0 status body
  while IFS= read -r body; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$API_URL$path" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data "$body")"
    case "$status" in
      201) created=$((created + 1)) ;;
      409) present=$((present + 1)) ;;
      *) echo "POST $path answered $status for: $body" >&2; exit 1 ;;
    esac
  done < <(jq -c '.[]' "$file")
  echo "$path: $created created, $present already present"
}

post /api/v1/items "$DATA_DIR/items.json"
