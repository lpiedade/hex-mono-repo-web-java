#!/usr/bin/env bash
#
# Builds every artefact the AWS environment deploys and publishes it:
#
#   - the API and portal-BFF exec jars, then their container images, to ECR
#   - the SPA bundle, to the S3 bucket CloudFront serves
#
# Everything it needs comes from 01-infra's outputs, so it takes no arguments
# in the common case:
#
#   infra/scripts/build-and-push.sh
#
# It prints the image tag it published at the end. That value is
# 02-platform's `image_tag`.
#
# Options:
#   --tag <tag>      publish under this tag instead of the short git sha
#   --skip-maven     reuse the jars already in target/
#   --skip-images    do not build or push any container image
#   --skip-spa       do not build or upload the SPA
#   --no-invalidate  skip the CloudFront invalidation
#
# Environment:
#   APP_BASE_PATH    the SPA's base path without slashes (default: app). Must
#                    match `base` in portal/web/vite.config.ts and `base_path`
#                    in infra/terraform/02-platform/locals.tf.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
infra_dir="${repo_root}/infra/terraform/01-infra"
platform_dir="${repo_root}/infra/terraform/02-platform"
base_path="${APP_BASE_PATH:-app}"

tag=""
skip_maven=false
skip_images=false
skip_spa=false
invalidate=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)           tag="$2"; shift 2 ;;
    --skip-maven)    skip_maven=true; shift ;;
    --skip-images)   skip_images=true; shift ;;
    --skip-spa)      skip_spa=true; shift ;;
    --no-invalidate) invalidate=false; shift ;;
    # Prints the header block by shape rather than by line number, so a new
    # option added above never falls out of --help.
    -h|--help)       awk 'NR>1 { if (/^#/) { sub(/^# ?/, ""); print } else exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)               echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31merror: %s\033[0m\n' "$*" >&2; exit 1; }

for tool in terraform docker aws jq mvn npm git; do
  command -v "$tool" >/dev/null || die "$tool is not on PATH"
done

if [[ -z "$tag" ]]; then
  tag="$(git -C "$repo_root" rev-parse --short=7 HEAD)"
  # A dirty tree would publish an image whose sha names a commit it does not
  # contain, and 02-platform deploys by sha.
  if [[ -n "$(git -C "$repo_root" status --porcelain)" ]]; then
    tag="${tag}-dirty"
  fi
fi

log "Reading 01-infra outputs"
[[ -d "${infra_dir}/.terraform" ]] || die "01-infra is not initialised - run terraform init there first"
infra_out="$(terraform -chdir="$infra_dir" output -json)"

region="$(jq -r '.region.value' <<<"$infra_out")"
spa_bucket="$(jq -r '.spa_bucket.value' <<<"$infra_out")"
ecr_url() { jq -r --arg k "$1" '.ecr_repository_urls.value[$k] // empty' <<<"$infra_out"; }

api_repo="$(ecr_url api)"
bff_repo="$(ecr_url portal-bff)"
[[ -n "$api_repo" && -n "$bff_repo" ]] || die "01-infra's ecr_repository_urls lacks api or portal-bff"
registry="${api_repo%%/*}"

echo "region:   ${region}"
echo "registry: ${registry}"
echo "tag:      ${tag}"

# -- Jars ---------------------------------------------------------------------
#
# Never `-T`: the openapi-generator in apps/api has a race under parallel
# builds where test-compile starts before the generator registers its output
# directory, producing "cannot find symbol" errors that vanish on a
# sequential re-run.
if [[ "$skip_maven" == false ]]; then
  log "Building the API and portal exec jars"
  mvn -f "${repo_root}/pom.xml" -pl apps/api,portal -am -DskipTests clean package
fi

api_jar="$(ls "${repo_root}"/apps/api/target/api-*-exec.jar 2>/dev/null | head -1 || true)"
bff_jar="$(ls "${repo_root}"/portal/target/portal-*-exec.jar 2>/dev/null | head -1 || true)"
[[ -n "$api_jar" ]] || die "no API exec jar in apps/api/target - rerun without --skip-maven"
[[ -n "$bff_jar" ]] || die "no portal exec jar in portal/target - rerun without --skip-maven"

# -- Images -------------------------------------------------------------------
if [[ "$skip_images" == false ]]; then
  log "Logging in to ECR"
  aws ecr get-login-password --region "$region" \
    | docker login --username AWS --password-stdin "$registry"

  build_and_push() {
    local url="$1" dockerfile="$2"; shift 2

    log "Building ${url##*/}"
    docker build \
      --platform linux/amd64 \
      -f "${repo_root}/infra/docker/${dockerfile}" \
      -t "${url}:${tag}" \
      -t "${url}:latest" \
      "$@" \
      "$repo_root"

    docker push "${url}:${tag}"
    docker push "${url}:latest"
  }

  build_and_push "$api_repo" Dockerfile.api        --build-arg "JAR_FILE=${api_jar#"$repo_root"/}"
  build_and_push "$bff_repo" Dockerfile.portal-bff --build-arg "JAR_FILE=${bff_jar#"$repo_root"/}"
fi

# -- SPA ----------------------------------------------------------------------
if [[ "$skip_spa" == false ]]; then
  log "Building the SPA"
  (
    cd "${repo_root}/portal/web"
    npm ci
    VITE_GIT_COMMIT="$tag" \
    VITE_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    npm run build
  )

  log "Uploading the SPA to s3://${spa_bucket}/${base_path}/"
  # Hashed bundles are content-addressed, so they are immutable and cached
  # for a year. The shell is not: it names the current bundles and must be
  # revalidated on every load, or a deploy would leave browsers asking for
  # assets that no longer exist.
  aws s3 sync "${repo_root}/portal/web/dist/" "s3://${spa_bucket}/${base_path}/" \
    --region "$region" \
    --delete \
    --exclude "index.html" \
    --cache-control "public,max-age=31536000,immutable"

  aws s3 cp "${repo_root}/portal/web/dist/index.html" "s3://${spa_bucket}/${base_path}/index.html" \
    --region "$region" \
    --cache-control "no-cache,must-revalidate" \
    --content-type "text/html"

  if [[ "$invalidate" == true && -d "${platform_dir}/.terraform" ]]; then
    distribution="$(terraform -chdir="$platform_dir" output -raw cloudfront_distribution_id 2>/dev/null || true)"
    if [[ -n "$distribution" ]]; then
      log "Invalidating the shell on CloudFront (${distribution})"
      aws cloudfront create-invalidation \
        --distribution-id "$distribution" \
        --paths "/${base_path}/index.html" "/${base_path}/" \
        --query 'Invalidation.Id' --output text
    else
      echo "02-platform has no distribution yet - skipping invalidation"
    fi
  fi
fi

log "Published tag: ${tag}"
cat <<EOF

Deploy it with:

  terraform -chdir=infra/terraform/02-platform apply -var="image_tag=${tag}"
EOF
