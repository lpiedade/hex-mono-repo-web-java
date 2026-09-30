#!/usr/bin/env bash
#
# init-project.sh - turn this template into a new project.
#
# Renames the Java base package and groupId (com.example.app), the artifact and
# application names (app-parent, app-api, app-portal, app-portal-web), the CLI
# command, the POM display name, and the project name used by compose, the local
# scripts and Terraform (database, role, namespace, SSM prefix, state bucket
# examples). It moves the Java source directories to match the new package.
#
# It deliberately does NOT rename:
#   * the URL base path /app and the APP_ environment-variable prefix - generic,
#     and wired through the SPA, the BFF, CloudFront and every script;
#   * class names such as AppApiApplication - rename them in your IDE if you like;
#   * the example aggregate `items` - replace it with your first real one.
#
# Usage:
#   ./init-project.sh --group com.acme.orders --name orders [--display "Orders"] [--dry-run]
#
#   --group    Java base package and Maven groupId (lowercase, dotted, >= 2 parts)
#   --name     project slug: lowercase letters, digits and '-' (e.g. orders, order-desk)
#   --display  human name for POM names and headings (default: --name, capitalised)
#   --dry-run  list the files that would change, and change nothing
#
# Run it once, on a fresh copy, before the first commit. Then:
#   mvn clean verify
#   (cd portal/web && npm install && npm run test:coverage && npm run build)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OLD_GROUP="com.example.app"
OLD_GROUP_PATH="com/example/app"

GROUP=""
NAME=""
DISPLAY=""
DRY_RUN=false

usage() { awk 'NR>1 { if (/^#/) { sub(/^# ?/, ""); print } else exit }' "${BASH_SOURCE[0]}"; }
die() { echo "init-project: $*" >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --group)   GROUP="${2:-}"; shift ;;
    --name)    NAME="${2:-}"; shift ;;
    --display) DISPLAY="${2:-}"; shift ;;
    --dry-run) DRY_RUN=true ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

[[ -n "$GROUP" && -n "$NAME" ]] || { usage; exit 2; }
[[ "$GROUP" =~ ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$ ]] || die "--group must look like com.acme.orders"
[[ "$NAME" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]] || die "--name must be lowercase letters, digits and '-'"
[[ "$GROUP" != "$OLD_GROUP" ]] || die "--group is the template's own package"
[[ -n "$DISPLAY" ]] || DISPLAY="$(tr '[:lower:]' '[:upper:]' <<< "${NAME:0:1}")${NAME:1}"
[[ -d "$ROOT/core/src/main/java/$OLD_GROUP_PATH" ]] \
  || die "core/src/main/java/$OLD_GROUP_PATH not found - has this template already been initialised?"
command -v perl >/dev/null || die "perl is required"

GROUP_PATH="$(tr . / <<< "$GROUP")"
# PostgreSQL identifiers: '-' is not allowed unquoted.
DB="${NAME//-/_}"

# Every tracked text file, outside build output and dependencies.
text_files() {
  find "$ROOT" \
    \( -name .git -o -name node_modules -o -name target -o -name dist -o -name coverage \
       -o -name .terraform -o -name .run -o -name .idea -o -name .vscode \) -prune -o \
    -type f ! -name init-project.sh ! -name '*.png' ! -name '*.jpg' ! -name '*.ico' \
       ! -name '*.woff' ! -name '*.woff2' ! -name '*.jar' -print \
    | while IFS= read -r file; do
        grep -Iq . "$file" 2>/dev/null && printf '%s\n' "$file"
      done
}

# The rewrite, as one perl program applied to every text file. Each rule targets
# a literal the template uses as the project name, never the bare word "app".
export OLD_GROUP OLD_GROUP_PATH GROUP GROUP_PATH NAME DISPLAY DB
read -r -d '' RULES <<'PERL' || true
  s/\Q$ENV{OLD_GROUP}\E/$ENV{GROUP}/g;
  s/\Q$ENV{OLD_GROUP_PATH}\E/$ENV{GROUP_PATH}/g;
  s/\bapp-(parent|api|portal-web|portal)\b/$ENV{NAME}-$1/g;
  s/<name>App<\/name>/<name>$ENV{DISPLAY}<\/name>/g;
  s/<name>App :: /<name>$ENV{DISPLAY} :: /g;
  # CLI command and version string
  s/name = "app",/name = "$ENV{NAME}",/g;
  s/"app 0\.1\.0-SNAPSHOT"/"$ENV{NAME} 0.1.0-SNAPSHOT"/g;
  # database and role
  s#5432/app\b#5432/$ENV{DB}#g;
  s/APP_DB_USERNAME:app\}/APP_DB_USERNAME:$ENV{DB}}/g;
  s/POSTGRES_(DB|USER): app$/POSTGRES_$1: $ENV{DB}/g;
  s/-U app -d app\b/-U $ENV{DB} -d $ENV{DB}/g;
  s/\bdb=app user=app\b/db=$ENV{DB} user=$ENV{DB}/g;
  s/\b(db_name|db_role)(\s*)= "app"/$1$2= "$ENV{DB}"/g;
  # compose project, Terraform project / namespace / SSM / state-bucket examples
  s/^name: app$/name: $ENV{NAME}/;
  s/^(\s*(?:project|namespace)\s*)= "app"/$1= "$ENV{NAME}"/;
  s/\bapp-(dev|secrets)\b/$ENV{NAME}-$1/g;
  s#/app-dev\b#/$ENV{NAME}-dev#g;
  s#realms/app"#realms/$ENV{NAME}"#g;
PERL

# The Terraform `project` variable's default is matched in context, so no other
# default = "app" is touched.
read -r -d '' TF_RULE <<'PERL' || true
  s/(variable\s+"(?:project|namespace)"\s*\{[^}]*?default\s*=\s*)"app"/$1"$ENV{NAME}"/gs;
PERL

# One pass per file into a temporary copy: the same rewrite decides whether the
# file changes and, outside --dry-run, becomes its new content.
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
changed=()
while IFS= read -r file; do
  perl -pe "$RULES" "$file" > "$scratch/line"
  if [[ "$file" == *.tf ]]; then
    perl -0pe "$TF_RULE" "$scratch/line" > "$scratch/out"
  else
    mv "$scratch/line" "$scratch/out"
  fi
  if ! cmp -s "$file" "$scratch/out"; then
    changed+=("$file")
    # cat, not mv: keeps the file's mode (scripts stay executable).
    [[ "$DRY_RUN" == true ]] || cat "$scratch/out" > "$file"
  fi
done < <(text_files)

if [[ "$DRY_RUN" == true ]]; then
  printf 'Would rewrite %d files:\n' "${#changed[@]}"
  printf '  %s\n' "${changed[@]#"$ROOT"/}"
  echo "Would move $OLD_GROUP_PATH -> $GROUP_PATH in every src/{main,test}/java."
  exit 0
fi

# Move the Java sources to the new package directories.
moved=0
while IFS= read -r dir; do
  parent="${dir%/"$OLD_GROUP_PATH"}"
  mkdir -p "$parent/$GROUP_PATH"
  # Move the contents, not the directory, so a new package that shares a prefix
  # with the old one (com.example.orders) is handled too.
  find "$dir" -mindepth 1 -maxdepth 1 -exec mv {} "$parent/$GROUP_PATH/" \;
  rmdir "$dir"
  # Remove now-empty parents of the old path (com/example), never the new one.
  old_parent="$(dirname "$dir")"
  while [[ "$old_parent" != "$parent" ]] && rmdir "$old_parent" 2>/dev/null; do
    old_parent="$(dirname "$old_parent")"
  done
  moved=$((moved + 1))
done < <(find "$ROOT" -path '*/node_modules' -prune -o -path '*/target' -prune -o \
           -type d -path "*/src/*/java/$OLD_GROUP_PATH" -print)

cat <<EOF
Initialised $DISPLAY:
  package / groupId : $GROUP
  artifacts         : $NAME-parent, $NAME-api, $NAME-portal, $NAME-portal-web
  database / role   : $DB
  files rewritten   : ${#changed[@]}
  source trees moved: $moved

Next:
  1. git init && git add -A && git commit -m "chore: initialise from template"
  2. mvn clean verify
  3. (cd portal/web && npm install && npm run test:coverage && npm run build)
  4. Replace the example aggregate 'items' (CONTEXT.md, the contracts, core, adapters, apps, portal).
  5. Review the ADRs in docs/adr and record your own from ADR-000-template.md.
EOF
