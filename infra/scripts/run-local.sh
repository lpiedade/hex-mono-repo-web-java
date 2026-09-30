#!/usr/bin/env bash
#
# run-local.sh - bring up the App stack for manual and exploratory testing,
# then stream logs until you press Ctrl-C.
#
# Components started:
#   * PostgreSQL (docker compose)  localhost:5432   db=app user=app pw=$APP_DB_PASSWORD (.env)
#   * API (Spring Boot)            http://localhost:8080   /api/v1, dev-token auth, profile `dev`
#   * Portal BFF (Spring Boot)     http://localhost:8081   /app/bff/**, /app/health, /app/about
#   * SPA (Vite dev server)        http://localhost:5173/app/   hot reload; proxies the
#                                  BFF routes to :8081 (portal/web/vite.config.ts)
#
# Authentication is the local shortcut: the API runs with APP_AUTH_MODE=dev-token
# and the BFF with APP_BFF_AUTH_MODE=dev, injecting the token into every proxied
# call. The token is generated fresh on every run (never committed) and written
# to .run/dev-token; set APP_AUTH_DEV_TOKEN to pin one instead.
#
# Both JVMs start with the `dev` Spring profile, which enables Swagger UI on the
# API. Override with SPRING_PROFILES_ACTIVE, but not with `prod`: the API refuses
# dev-token mode under it.
#
# Usage:
#   infra/scripts/run-local.sh                 # build, start everything, tail logs
#   infra/scripts/run-local.sh --no-build      # reuse existing exec jars (skip Maven)
#   infra/scripts/run-local.sh --no-frontend   # skip the Vite dev server
#   infra/scripts/run-local.sh --detach        # return once healthy instead of tailing
#   infra/scripts/run-local.sh --seed          # also load infra/test-fixtures/dev-data (seed-dev-data.sh)
#   infra/scripts/run-local.sh --down          # stop everything, including the database
#   SKIP_BUILD=1 infra/scripts/run-local.sh    # same as --no-build
#
# On Ctrl-C the API, BFF and Vite processes stop; the database keeps running so
# your data survives between iterations. `--down` (or infra/scripts/stop-local.sh)
# stops it too. Logs and PID files land under .run/ (git-ignored).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT/compose.yaml"
RUN_DIR="$ROOT/.run"

# Source .env without overwriting variables the caller already exported.
ENV_FILE="$ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r _env_line; do
    [[ "$_env_line" =~ ^[[:space:]]*(#|$) ]] && continue
    _env_key="${_env_line%%=*}"
    [[ -n "${!_env_key+x}" ]] || export "$_env_line" 2>/dev/null || true
  done < "$ENV_FILE"
  unset _env_line _env_key
fi

VERSION="0.1.0-SNAPSHOT"
API_JAR="$ROOT/apps/api/target/api-${VERSION}-exec.jar"
BFF_JAR="$ROOT/portal/target/portal-${VERSION}-exec.jar"
FRONTEND_DIR="$ROOT/portal/web"

API_PORT=8080
BFF_PORT=8081
FRONTEND_PORT=5173
DB_PORT=5432

PROFILES="${SPRING_PROFILES_ACTIVE:-dev}"

DO_BUILD=true
DO_FRONTEND=true
DO_DOWN=false
# --detach exists for infra/scripts/e2e.sh: an automated caller needs the stack
# up and control back, not an interactive log tail it would have to kill.
DO_TAIL=true
DO_SEED=false
[[ "${SKIP_BUILD:-0}" == "1" ]] && DO_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --no-build)    DO_BUILD=false ;;
    --no-frontend) DO_FRONTEND=false ;;
    --detach)      DO_TAIL=false ;;
    --seed)        DO_SEED=true ;;
    --down)        DO_DOWN=true ;;
    # Prints the header block, which ends at the first non-comment line.
    -h|--help)     awk 'NR>1 { if (/^#/) { sub(/^# ?/, ""); print } else exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Unknown argument: $arg (try --help)" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

banner() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
info()   { printf '    %s\n' "$*"; }
warn()   { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()    { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not on PATH. $2"; }

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

kill_tree() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  pkill -TERM -P "$pid" 2>/dev/null || true
  kill -TERM "$pid" 2>/dev/null || true
}

stop_from_pidfile() {
  local name="$1"
  local file="$RUN_DIR/$name.pid"
  if [[ -f "$file" ]]; then
    local pid; pid="$(cat "$file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      info "Stopping $name (pid $pid)..."
      kill_tree "$pid"
    fi
    rm -f "$file"
  fi
}

wait_for_db() {
  for _ in $(seq 1 60); do
    if compose exec -T postgres pg_isready -U app -d app >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

wait_for_http() {
  local url="$1" tries="${2:-90}"
  for _ in $(seq 1 "$tries"); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# teardown
# ---------------------------------------------------------------------------

teardown_apps() {
  stop_from_pidfile frontend
  stop_from_pidfile bff
  stop_from_pidfile api
}

full_down() {
  banner "Stopping the App stack"
  teardown_apps
  if command -v docker >/dev/null 2>&1; then
    info "Stopping containers (docker compose down, including the app profile)..."
    # Compose interpolates the whole file, including the required variables, even
    # to stop it; the values are irrelevant to `down`.
    APP_DB_PASSWORD="${APP_DB_PASSWORD:-unused}" \
    APP_AUTH_DEV_TOKEN="${APP_AUTH_DEV_TOKEN:-unused}" \
      compose --profile app down
  fi
  banner "Stack stopped."
}

if [[ "$DO_DOWN" == true ]]; then
  full_down
  exit 0
fi

# ---------------------------------------------------------------------------
# credentials
# ---------------------------------------------------------------------------

[[ -z "${APP_DB_PASSWORD:-}" ]] && \
  die "APP_DB_PASSWORD is not set. Copy .env.example to .env and set a password."
[[ "${APP_DB_PASSWORD:-}" == "change-me" ]] && \
  die "APP_DB_PASSWORD is still the .env.example placeholder. Set a real password in .env."

mkdir -p "$RUN_DIR"

# A fresh dev token per run unless the caller pins one. Exported because Compose
# interpolates it (see compose.yaml) even when only PostgreSQL is started.
if [[ -z "${APP_AUTH_DEV_TOKEN:-}" ]]; then
  need openssl "Install OpenSSL, or set APP_AUTH_DEV_TOKEN yourself."
  APP_AUTH_DEV_TOKEN="$(openssl rand -hex 24)"
fi
export APP_AUTH_DEV_TOKEN
( umask 077 && printf '%s\n' "$APP_AUTH_DEV_TOKEN" > "$RUN_DIR/dev-token" )

# On Ctrl-C (or normal exit after tailing) stop the app processes but keep the
# database running so data survives between iterations.
on_exit() {
  echo
  banner "Shutting down app processes (the database stays up)"
  teardown_apps
  info "PostgreSQL is still running. Stop it with: infra/scripts/run-local.sh --down"
  # Exit explicitly: without this the trap handler returns and bash resumes the
  # interrupted `tail -F`, so a SIGTERM would stop the apps but never quit.
  exit 0
}
trap on_exit INT TERM

# ---------------------------------------------------------------------------
# preflight
# ---------------------------------------------------------------------------

banner "Preflight"
need docker "Install Docker (or a compatible runtime such as Rancher Desktop) and start it."
docker compose version >/dev/null 2>&1 || die "'docker compose' plugin is unavailable. Update Docker."
docker info >/dev/null 2>&1 || die "Docker daemon is not reachable. Start your container runtime first."
need java "Install a JDK 25."
need curl "Install curl."
if [[ "$DO_BUILD" == true ]]; then
  need mvn "Install Maven 3.9+, or pass --no-build to reuse existing jars."
fi
if [[ "$DO_FRONTEND" == true ]]; then
  need node "Install Node.js 20+, or pass --no-frontend."
  need npm  "Install npm, or pass --no-frontend."
fi
for p in "$API_PORT" "$BFF_PORT"; do
  port_in_use "$p" && warn "Port $p is already in use - a previous run may still be up (try --down)."
done
info "OK."

# ---------------------------------------------------------------------------
# 1. database
# ---------------------------------------------------------------------------

banner "Starting PostgreSQL (docker compose up -d)"
compose up -d postgres
info "Waiting for postgres..."
wait_for_db || die "PostgreSQL did not become ready. Inspect: docker compose -f $COMPOSE_FILE logs postgres"
info "PostgreSQL ready."

# ---------------------------------------------------------------------------
# 2. build
# ---------------------------------------------------------------------------

# Never `-T`: see CLAUDE.md (openapi-generator race under parallel builds).
if [[ "$DO_BUILD" == true ]]; then
  banner "Building the API and BFF jars (mvn -DskipTests package)"
  ( cd "$ROOT" && mvn -q -DskipTests -pl apps/api,portal -am package )
else
  banner "Skipping build (--no-build)"
fi

[[ -f "$API_JAR" ]] || die "API jar not found: $API_JAR (rerun without --no-build to build it)."
[[ -f "$BFF_JAR" ]] || die "BFF jar not found: $BFF_JAR (rerun without --no-build to build it)."

# ---------------------------------------------------------------------------
# 3. API
# ---------------------------------------------------------------------------

banner "Starting the API on :$API_PORT (profile $PROFILES)"
SPRING_PROFILES_ACTIVE="$PROFILES" \
APP_AUTH_MODE=dev-token \
APP_AUTH_DEV_TOKEN="$APP_AUTH_DEV_TOKEN" \
APP_DB_URL="${APP_DB_URL:-jdbc:postgresql://localhost:$DB_PORT/app}" \
APP_DB_USERNAME="${APP_DB_USERNAME:-app}" \
APP_DB_PASSWORD="$APP_DB_PASSWORD" \
  java -jar "$API_JAR" > "$RUN_DIR/api.log" 2>&1 &
echo $! > "$RUN_DIR/api.pid"
info "pid $(cat "$RUN_DIR/api.pid"), log $RUN_DIR/api.log"
info "Waiting for API health..."
wait_for_http "http://localhost:$API_PORT/actuator/health" \
  || die "The API did not become healthy. See $RUN_DIR/api.log"
info "API healthy."

# ---------------------------------------------------------------------------
# 4. Portal BFF
# ---------------------------------------------------------------------------

banner "Starting the portal BFF on :$BFF_PORT (profile $PROFILES)"
SPRING_PROFILES_ACTIVE="$PROFILES" \
APP_BFF_AUTH_MODE=dev \
APP_AUTH_DEV_TOKEN="$APP_AUTH_DEV_TOKEN" \
APP_BFF_API_BASE_URL="http://localhost:$API_PORT" \
  java -jar "$BFF_JAR" > "$RUN_DIR/bff.log" 2>&1 &
echo $! > "$RUN_DIR/bff.pid"
info "pid $(cat "$RUN_DIR/bff.pid"), log $RUN_DIR/bff.log"
info "Waiting for BFF health..."
wait_for_http "http://localhost:$BFF_PORT/app/health" \
  || die "The BFF did not become healthy. See $RUN_DIR/bff.log"
info "BFF healthy."

if [[ "$DO_SEED" == true ]]; then
  banner "Seeding the development dataset"
  APP_API_URL="http://localhost:$API_PORT" APP_API_TOKEN="$APP_AUTH_DEV_TOKEN" \
    "$ROOT/infra/scripts/seed-dev-data.sh"
fi

# ---------------------------------------------------------------------------
# 5. frontend (Vite dev server)
# ---------------------------------------------------------------------------

if [[ "$DO_FRONTEND" == true ]]; then
  banner "Starting the Vite dev server on :$FRONTEND_PORT"
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    info "Installing frontend dependencies (npm ci)..."
    ( cd "$FRONTEND_DIR" && npm ci )
  fi
  ( cd "$FRONTEND_DIR" && npm run --silent --if-present generate:api )
  (
    cd "$FRONTEND_DIR"
    VITE_GIT_COMMIT="$(git -C "$ROOT" rev-parse --short=7 HEAD 2>/dev/null || echo unknown)" \
    VITE_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    npm run --silent dev -- --port "$FRONTEND_PORT" --strictPort
  ) > "$RUN_DIR/frontend.log" 2>&1 &
  echo $! > "$RUN_DIR/frontend.pid"
  info "pid $(cat "$RUN_DIR/frontend.pid"), log $RUN_DIR/frontend.log"
  if wait_for_http "http://localhost:$FRONTEND_PORT/app/" 30; then
    info "Vite dev server up."
  else
    warn "Vite dev server not confirmed yet; check $RUN_DIR/frontend.log"
  fi
else
  banner "Skipping the Vite dev server (--no-frontend)"
fi

# ---------------------------------------------------------------------------
# summary
# ---------------------------------------------------------------------------

banner "App is up"
cat <<EOF
  Dev token : $RUN_DIR/dev-token   (Authorization: Bearer \$(cat $RUN_DIR/dev-token))
  Profiles  : $PROFILES

  API       : http://localhost:$API_PORT       (health: /actuator/health)
  Swagger UI: http://localhost:$API_PORT/swagger-ui.html   (profile 'dev')
  BFF       : http://localhost:$BFF_PORT       (health: /app/health)
EOF
if [[ "$DO_FRONTEND" == true ]]; then
  echo "  Portal    : http://localhost:$FRONTEND_PORT/app/   (hot reload)"
fi
cat <<EOF
  Database  : localhost:$DB_PORT (db=app, user=app)

  Try it:
    curl -H "Authorization: Bearer \$(cat $RUN_DIR/dev-token)" http://localhost:$API_PORT/api/v1/items
    curl http://localhost:$BFF_PORT/app/bff/v1/items   # the BFF injects the token

  Logs: tail -f $RUN_DIR/*.log
  Stop: Ctrl-C (apps) - infra/scripts/run-local.sh --down (everything, including the database)
EOF

if [[ "$DO_TAIL" != true ]]; then
  banner "Detached - the stack keeps running; stop it with infra/scripts/stop-local.sh"
  exit 0
fi

banner "Tailing logs - press Ctrl-C to stop the app processes"
tail -n +1 -F "$RUN_DIR"/api.log "$RUN_DIR"/bff.log \
  $([[ "$DO_FRONTEND" == true ]] && echo "$RUN_DIR/frontend.log")
