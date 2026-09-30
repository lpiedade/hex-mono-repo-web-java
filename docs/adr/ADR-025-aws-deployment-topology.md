# ADR-025: AWS deployment topology — EKS, one RDS server, and CloudFront for the SPA

- Status: Accepted
- Date: Template baseline
- Related: [ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md),
  [ADR-007](ADR-007-spring-boot-http-api-composition-root.md),
  [ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md),
  [ADR-009](ADR-009-react-typescript-and-spring-bff.md),
  [ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md),
  [ADR-011](ADR-011-jwt-resource-server-and-roles.md),
  [ADR-021](ADR-021-one-migration-stream-and-one-baseline.md),
  [ADR-026](ADR-026-cli-is-a-client-of-the-api.md)

## Context

A compose file describes how the product runs on one machine; it is not a
statement about how the product is hosted. The template ships one described
hosted topology, on AWS, as Terraform under `infra/terraform/`. It is a
starting point: a single environment, no multi-AZ, sized to be demonstrated
and then scaled or rebuilt. It is not a production landing zone, and several
decisions below would be wrong for one. They are recorded anyway, because an
undocumented starting point is how a starting point becomes production by
accident.

Two properties of the codebase constrain the shape more than any AWS
consideration:

1. **The BFF does not serve the SPA.** `portal/web` builds to static files, and
   the BFF is a thin authenticated proxy ([ADR-009](ADR-009-react-typescript-and-spring-bff.md)).
   The SPA has no reverse proxy of its own; whatever edge fronts an
   environment serves `index.html` and gives the browser a single origin
   ([ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md)). A single origin
   is how CORS is eliminated by topology rather than by policy, and any hosted
   topology has to provide that edge.
2. **A database's separation is of credentials and migration streams, not of
   servers.** Each database has its own login role and its own Flyway stream
   ([ADR-008](ADR-008-postgresql-spring-jdbc-flyway.md),
   [ADR-021](ADR-021-one-migration-stream-and-one-baseline.md)). Nothing in
   the code requires a server per database.

## Decision

### Compute: EKS, with the workloads declared in Terraform

An EKS cluster with a managed node group runs the API (`apps/api`, :8080) and
the BFF (`portal/bff`, :8081). Terraform declares the workloads too —
`kubernetes_*` resources for the core objects and Helm for the add-ons (the
AWS Load Balancer Controller, the External Secrets Operator, and a log
shipper) — rather than handing off to a separately applied manifest tree. One
tool, one apply order, one place where the environment is described. Images
live in ECR.

The code is three stacks under `infra/terraform/`:

- `00-bootstrap/` — the S3 bucket holding the other two stacks' state. Its own
  state is local, because a bucket cannot store the state that creates it.
- `01-infra/` — VPC, EKS, RDS, ECR, the SPA bucket, the secrets, the IRSA
  roles.
- `02-platform/` — the add-ons, the database role, the workloads, the Ingress,
  the WAF, and the CloudFront distribution.

The split is not aesthetic. The `kubernetes`, `helm` and `postgresql`
providers are configured from values that do not exist until a cluster and a
database do; configuring a provider from a resource created in the same apply
is the failure mode that makes `terraform plan` unusable against an empty
state and `terraform destroy` unusable at all.

### Persistence: one RDS PostgreSQL server

One private RDS PostgreSQL instance holds the `app` database, owned by the
`app` login role the API connects with. The database and its role are created
by `02-platform` through the `postgresql` provider, so no workload connects as
the RDS master account; Flyway still owns every table in the database. A
second database, when one arrives, gets its own role and its own migration
stream on the same server — not a second server.

### The SPA: S3 and CloudFront

On AWS the SPA is uploaded to a private S3 bucket and served by a CloudFront
distribution with two origins: S3 for the static files under `/app/`, and the
ALB for the BFF's routes (`/app/bff/*`, `/app/health`, `/app/about`). No
container serves the SPA. The browser sees one origin — CloudFront — so CORS is
eliminated by topology, and the API's allowed-origins list stays empty.

The static-serving rules
[ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md) requires of every edge
are implemented by a CloudFront Function at the viewer-request event,
`infra/terraform/02-platform/spa-router.js`:

- a stale hashed bundle under `/app/assets/` passes through untouched and gets
  S3's own 404, never the shell;
- every other extensionless path under `/app/` is rewritten to
  `/app/index.html`, so React Router owns client-side navigation.

The BFF's routes, including the OIDC login and callback under `/app/bff/`,
are separate cache behaviours that go to the ALB before the function ever
runs, so client-side routing cannot shadow them.

A function, not a `custom_error_response`: a custom error response is
distribution-wide and cannot tell a missing content-addressed bundle from a
client-side route, which is exactly the distinction the first guarantee is.

### Exposure: CloudFront in front, the ALB reachable from nowhere else

The ALB is created by the Ingress and is internet-facing, but its security
group admits only the `com.amazonaws.global.cloudfront.origin-facing` managed
prefix list, so the WAF web ACL at the edge cannot be bypassed by resolving
the ALB's hostname. TLS terminates at CloudFront.

The Ingress routes the BFF's paths to the BFF and nothing else. **The API is
not exposed at the edge**: it is a cluster-internal Service, and the BFF reaches
it in-cluster. The API still authenticates every request itself with a bearer
token ([ADR-011](ADR-011-jwt-resource-server-and-roles.md)), so being internal
is a second control, not the only one. A non-browser client — the CLI
([ADR-026](ADR-026-cli-is-a-client-of-the-api.md)) — reaches a hosted API
through a route into the cluster (`kubectl port-forward`, or a client inside the
VPC). Exposing `/api/*` through CloudFront and the same WAF is a two-line
change to the Ingress and the distribution, and is deliberately left to the
project that needs it.

### Identity and secrets

The deployment runs the default authentication modes: `jwt` for the API and
`oidc` for the BFF ([ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md),
[ADR-011](ADR-011-jwt-resource-server-and-roles.md)). `dev-token` is for local
development, and the API refuses it under the `prod` profile.

Terraform generates the database passwords and writes them to SSM Parameter
Store as `SecureString` parameters under one prefix; secrets that come from
outside — the BFF's OIDC client credentials — are stored there too. The
External Secrets Operator (a `ClusterSecretStore` backed by Parameter Store)
materialises them as Kubernetes Secrets through IRSA. No password is typed by
a human and none appears in a manifest.

No pod has a persistent volume. Anything a workload would otherwise provision
into its own filesystem on first start must be pinned in Parameter Store
instead, or a restart silently replaces it.

## Alternatives considered

### A web-server pod serving the SPA behind the ALB — rejected

One more workload would serve `dist/` and forward the BFF's paths, with
CloudFront caching in front. Rejected because it puts a pod in the request path
of every static asset, adds an image to build and patch, and duplicates routing
CloudFront already does; CloudFront's edge cache over S3 is also what makes a
single-region origin serve a bundle acceptably to users elsewhere
([ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md)).

### CloudFront serving S3 only, with the browser calling the ALB directly — rejected

Two origins in the browser reintroduces exactly the CORS configuration
ADR-017 rejects, and widens the API's allowed-origins list from empty to a
hostname that changes with the environment.

### A second RDS instance per database — rejected

The separation the code requires is of credentials and migration streams, and
both are intact with one server. A second instance doubles the fixed cost of
the environment to isolate a blast radius that a starting environment does
not have.

### `kubernetes_manifest` for the External Secrets objects — rejected

That resource resolves an object's schema from the API server at plan time, so
a manifest whose CRD is installed in the same apply cannot be planned at all.
The External Secrets objects live in a small local Helm chart instead.

### Multi-AZ RDS, a NAT gateway per AZ — rejected for now

Both are single-variable changes in `01-infra`. Neither is justified by an
environment that is expected to be rebuilt rather than recovered.

## Consequences

### Positive

- The deployment is described in one reviewable place, and the description is
  executable.
- The workloads are disposable: no volume, no key file, no state outside RDS
  and Parameter Store.
- The ALB is unreachable except through CloudFront, so a single WAF web ACL is
  the whole ingress control surface.

### Negative

- **The environment is open by default.** The WAF's allowed CIDR lists default
  to everything: the web ACL is provisioned but filters nothing until someone
  narrows it, and until then authentication is the only control. An IP set
  holds one address family, so IPv4 and IPv6 are two lists, and narrowing one
  while leaving the other at its default still admits that whole family.
- **Terraform state holds secrets in clear text.** Generated passwords are in
  the state of the stacks that create or read them. The state bucket is
  encrypted and closed; the property is Terraform's and no provider choice
  removes it.
- **A CLI cannot reach a hosted API without a route into the cluster.** That is
  the price of keeping the API off the edge; the change that removes it is
  named above.
- **Applying requires a route into the VPC.** `02-platform` cannot be applied
  from an arbitrary laptop: the `postgresql` provider needs the private RDS
  instance, which has no public address and no bastion. Whoever applies it
  needs a network path into the VPC.
- **The BFF keeps sessions in memory**
  ([ADR-010](ADR-010-oidc-server-side-session-and-browser-security.md)), so
  running more than one BFF replica requires ALB session stickiness or Spring
  Session first — raising the replica count alone logs users out at random.
- **The static-serving rules are implemented twice** — in the Vite proxy used
  locally and in browser tests
  ([ADR-017](ADR-017-static-spa-without-a-reverse-proxy.md)) and in
  `spa-router.js` plus the distribution's cache behaviours here. A change to one
  has to be made in the other, and nothing enforces that. Whether `spa-router.js` is correct is answered in AWS, or by a test
  written against it directly — not by a local browser.
