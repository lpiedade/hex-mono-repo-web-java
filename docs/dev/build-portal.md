# Building and running the portal

The portal has two halves, the Spring Boot BFF (`portal/bff/`) and the React
SPA (`portal/web/`), with two matching build recipes (ADR-009, ADR-017): the
BFF is built by Maven and the SPA by npm; neither calls the other.

## Quick reference

| What | Command | Where to run |
|------|---------|--------------|
| Build the BFF | `mvn clean verify -pl portal -am` | repo root |
| Build the SPA | `npm run build` | `portal/web/` |
| Lint, test and build the SPA (the CI gate) | `npm ci && npm run lint && npm run format:check && npm run test:coverage && npm run build` | `portal/web/` |
| Format the SPA's sources | `npm run format` | `portal/web/` |
| Run the full local stack | `infra/scripts/run-local.sh` | repo root |
| Run the SPA dev server | `npm run dev` | `portal/web/` |
| Run the API and BFF in containers | `docker compose --profile app up -d --build` | repo root |
| Serve the production bundle | `npm run build && npx vite preview` | `portal/web/` |

## Toolchain

| Tool | Version | Notes |
|------|---------|-------|
| Java / JDK | 25 | ADR-001 |
| Maven | 3.9+ | never with `-T` |
| Node | 20+ | the version CI uses (`.github/workflows/build.yaml`) |
| npm | bundled with Node | `package-lock.json` is committed - do not use `yarn` or `pnpm` |

## Building the BFF

The BFF is the `portal` Maven module:

```
mvn clean verify -pl portal -am
```

This produces `portal/target/portal-0.1.0-SNAPSHOT-exec.jar`, the executable
Spring Boot jar. It listens on port 8081 and owns `/app/bff/**` (the proxy to
the API, the OIDC login and callback, logout), `/app/health` and `/app/about`.
It reads its configuration from environment variables; see `.env.example`.
The minimum for a local run, against an API on :8080 in dev-token mode:

```
export APP_BFF_API_BASE_URL=http://localhost:8080
export APP_BFF_AUTH_MODE=dev
export APP_AUTH_DEV_TOKEN="$(cat .run/dev-token)"   # must match the API's token
java -jar portal/target/portal-0.1.0-SNAPSHOT-exec.jar
```

With `APP_BFF_AUTH_MODE=oidc` (the default) it needs `APP_OIDC_ISSUER_URI`,
`APP_OIDC_CLIENT_ID` and `APP_OIDC_CLIENT_SECRET` instead, and runs the
authorization-code login itself (ADR-010).

## Building the SPA

The SPA is a standalone npm project in `portal/web/`. `mvn clean verify` does
not produce the frontend bundle.

The `generate:api` hook regenerates the TypeScript client from the portal
OpenAPI contract before every build, test, typecheck and lint run (ADR-012).
The generated file (`src/api/portal-api.d.ts`) is git-ignored.

### Fast local feedback

```
cd portal/web
npm run dev        # Vite dev server on :5173, proxies the BFF routes to :8081
```

The dev server serves the SPA under `/app/` and proxies `/app/bff/**`,
`/app/health` and `/app/about` to `localhost:8081`, so the browser still sees a
single origin and no CORS policy is involved (`portal/web/vite.config.ts`).

### Full build (lint, format, typecheck, coverage gate, production bundle)

This is what CI runs and what the coverage ratchet checks:

```
cd portal/web
npm ci
npm run lint            # ESLint, type-aware; a warning fails as an error does
npm run format:check    # Prettier; `npm run format` writes the fixes
npm run test:coverage   # typecheck (browser + e2e projects), then Vitest with --coverage
npm run build           # tsc --noEmit + vite build -> dist/
```

A component test fails on any `console.error` or `console.warn` it did not
declare with `expectConsole()` (`src/test-setup.ts`), so a clean run is part of
the gate, not a nicety.

The production bundle lands in `portal/web/dist/`: plain static assets, with no
server of its own (ADR-017). Screens beyond the landing page are split into
chunks of their own and loaded on demand, and third-party code is grouped into
`react`, `mui` and `vendor` chunks; the build keeps Vite's default 500 kB
chunk-size warning, so a chunk that outgrows it shows up in the build output. `npx vite preview` serves it on :4173 with the same
proxy as the dev server, which is what the accessibility and journey suites
load, and `infra/scripts/build-and-push.sh` uploads it to the S3 bucket
CloudFront serves (ADR-025).

## Running the API and BFF in containers

`compose.yaml`'s `app` profile runs the two jars as containers; the SPA stays a
Vite process on the host, because it is static assets and needs no server:

| Service | Image | Host port |
|---------|-------|-----------|
| `postgres` | `postgres:17-alpine` | 5432 |
| `api` | `infra/docker/Dockerfile.api` | 8080 |
| `bff` | `infra/docker/Dockerfile.portal-bff` | 8081 |

1. Build the jars the images copy:

   ```
   mvn clean verify -pl apps/api,portal -am
   ```

2. Copy `.env.example` to `.env` and set `APP_DB_PASSWORD` and
   `APP_AUTH_DEV_TOKEN` (`openssl rand -hex 24`).

3. Start the containers, then the SPA:

   ```
   docker compose --profile app up -d --build
   cd portal/web && npm run dev
   ```

The portal is at http://localhost:5173/app/. After a BFF or API change, rebuild
the jar and the image:

```
mvn clean verify -pl portal -am
docker compose --profile app up -d --build bff
```

### What this does not cover

Neither the dev server nor `vite preview` applies the production serving rules
CloudFront does on AWS: a missing hashed bundle under `/app/assets/` must 404
rather than fall back to the shell, and every other extensionless path under
`/app/` must return `index.html`. Those live only in
`infra/terraform/02-platform/spa-router.js`, a CloudFront Function, so a change
to them is verified on AWS or by a test written against that file.

## Dependency checks

Run these before a release; write the output under `target/`, which is
git-ignored:

```
# npm - from portal/web/
npm audit --audit-level=high
npx --yes @cyclonedx/cyclonedx-npm --output-format JSON --output-file ../../target/sbom-npm.json

# Maven - from the repo root
mvn org.cyclonedx:cyclonedx-maven-plugin:makeAggregateBom \
    -DoutputFormat=json -DoutputName=sbom-maven -DoutputDirectory=target
```

Record an accepted exception (a vulnerability with no fix, a dev-only exposure)
where your project keeps its decisions, with the advisory, the reason and the
planned resolution.
