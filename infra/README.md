# Infrastructure

Everything that runs the application somewhere other than a developer's IDE:
the container images, the local run scripts, and the Terraform that deploys to
AWS. The local topology itself is [`compose.yaml`](../compose.yaml) at the
repository root.

| Directory | Holds |
| --- | --- |
| `docker/` | `Dockerfile.api` and `Dockerfile.portal-bff`. The SPA has no image: it is static assets (ADR-017), uploaded to S3 on AWS. |
| `scripts/` | Local helpers (`run-local.sh`, `stop-local.sh`, `rebuild-local.sh`, `seed-dev-data.sh`), the browser journey runner (`e2e.sh`) and the AWS publisher (`build-and-push.sh`). Each prints its usage with `--help`. |
| `test-fixtures/` | Synthetic datasets for local development, loaded through the API (`run-local.sh --seed`). Its [README](test-fixtures/README.md) has the rules. |
| `terraform/` | The AWS deployment in three stacks. Its [README](terraform/README.md) is the deployment runbook. |

## Artefacts

The images copy pre-built artefacts; they never run Maven or npm themselves,
so a container ships exactly what CI tested.

| Artefact | Built by | Image |
| --- | --- | --- |
| `apps/api/target/api-0.1.0-SNAPSHOT-exec.jar` | `mvn clean verify -pl apps/api -am` | `docker/Dockerfile.api` (port 8080) |
| `portal/target/portal-0.1.0-SNAPSHOT-exec.jar` | `mvn clean verify -pl portal -am` | `docker/Dockerfile.portal-bff` (port 8081) |
| `portal/web/dist/` | `npm ci && npm run build` in `portal/web` | none - served by `vite preview` locally, by CloudFront from S3 on AWS |
| `apps/cli/target/cli-0.1.0-SNAPSHOT.jar` | `mvn clean verify -pl apps/cli -am` | none - run with `java -jar` |

The jar names carry the project version; the `JAR_FILE` build arguments in the
Dockerfiles and `VERSION` in `scripts/run-local.sh` move with it.

## Running locally

Three ways, from lightest to most production-like:

1. **Host JVMs, hot-reloading SPA** - `infra/scripts/run-local.sh`. Starts
   PostgreSQL in Compose, builds and runs the API (:8080) and the BFF (:8081)
   on the host, and the Vite dev server at http://localhost:5173/app/. Stop
   with Ctrl-C (apps) or `infra/scripts/stop-local.sh` (everything).
2. **API and BFF in containers** - build the jars, then
   `docker compose --profile app up -d --build`, and serve the SPA from
   `portal/web` with `npm run dev` (http://localhost:5173/app/) or
   `npm run build && npx vite preview` (http://localhost:4173/app/). Both
   proxy `/app/bff`, `/app/health` and `/app/about` to the BFF on :8081.
3. **Browser journeys against the real stack** - `infra/scripts/e2e.sh`
   (ADR-014).

Local runs authenticate with the development shortcut: the API in
`APP_AUTH_MODE=dev-token`, the BFF in `APP_BFF_AUTH_MODE=dev`, and a token
generated per run by `run-local.sh` (written to `.run/dev-token`, never
committed). Copy `.env.example` to `.env` first and set `APP_DB_PASSWORD`.
See [`docs/dev/`](../docs/dev/README.md) for the full developer guides.

## Deploying to AWS

`infra/scripts/build-and-push.sh` builds the jars and images, pushes them to
ECR, uploads the SPA to S3 and prints the tag to deploy;
[`terraform/README.md`](terraform/README.md) covers the apply order, the
secrets a human has to provide, and teardown.

Tools the deployment needs on the operator's machine: Terraform >= 1.10, the
AWS CLI, Docker, `git`, `jq`, a JDK 25 with Maven 3.9+, Node 20+, and, to look
at what the apply produced, `kubectl` and `helm`:

```bash
for t in terraform aws docker git jq mvn java node npm kubectl helm; do printf '%-10s ' "$t"; command -v "$t" || echo MISSING; done
```
