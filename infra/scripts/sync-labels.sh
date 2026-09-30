#!/usr/bin/env bash
#
# sync-labels.sh - make a GitHub repository's labels match .github/labels.yml.
#
# Creates missing labels and updates colour and description of existing ones.
# With --prune it also deletes every label the file does not declare, including
# GitHub's defaults (wontfix, enhancement, ...) - review the plan first with
# --dry-run.
#
# Usage:
#   infra/scripts/sync-labels.sh                      # repo of the current checkout
#   infra/scripts/sync-labels.sh --repo owner/name
#   infra/scripts/sync-labels.sh --prune --dry-run    # show what would be deleted
#
# Needs: gh (authenticated, or GH_TOKEN set).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABELS_FILE="$ROOT/.github/labels.yml"
REPO_ARGS=()
PRUNE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)    REPO_ARGS=(--repo "$2"); shift ;;
    --prune)   PRUNE=true ;;
    --dry-run) DRY_RUN=true ;;
    -h|--help) awk 'NR>1 { if (/^#/) { sub(/^# ?/, ""); print } else exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Unknown argument: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

command -v gh >/dev/null || { echo "gh is required" >&2; exit 2; }

# Reads the flat "- name / color / description" blocks into name<TAB>color<TAB>description.
parse() {
  awk '
    function value(line) { sub(/^[^:]*:[ \t]*/, "", line); gsub(/^"|"$/, "", line); return line }
    /^- name:/        { if (name != "") print name "\t" color "\t" desc; name = value($0); color = ""; desc = "" }
    /^  color:/       { color = value($0) }
    /^  description:/ { desc = value($0) }
    END               { if (name != "") print name "\t" color "\t" desc }
  ' "$LABELS_FILE"
}

run() {
  if [[ "$DRY_RUN" == true ]]; then
    printf 'would run: %s\n' "$*"
  else
    "$@"
  fi
}

declared=()
while IFS=$'\t' read -r name color description; do
  declared+=("$name")
  run gh label create "$name" --color "$color" --description "$description" --force "${REPO_ARGS[@]}"
done < <(parse)
echo "Synced ${#declared[@]} labels from .github/labels.yml"

if [[ "$PRUNE" == true ]]; then
  while IFS= read -r existing; do
    keep=false
    for name in "${declared[@]}"; do
      [[ "$existing" == "$name" ]] && keep=true && break
    done
    [[ "$keep" == true ]] || run gh label delete "$existing" --yes "${REPO_ARGS[@]}"
  done < <(gh label list --limit 200 --json name --jq '.[].name' "${REPO_ARGS[@]}")
fi
