# AWS deployment

Terraform for one environment: an EKS cluster running the API and the portal
BFF, one private RDS PostgreSQL server holding the operational database, and
the SPA in S3 behind CloudFront and a WAF.

The reasoning behind every choice here, and the ones that would be wrong for
production, is [ADR-025](../../docs/adr/ADR-025-aws-deployment-topology.md).
Read it before changing anything in this directory.

## What gets created

| Stack | Holds | State |
| --- | --- | --- |
| `00-bootstrap/` | The S3 bucket for the other two stacks' state | Local, on disk |
| `01-infra/` | VPC, EKS, RDS, ECR, SPA bucket, SSM parameters, IRSA roles, optional peering to the operator VPC | In that bucket |
| `02-platform/` | Add-ons, the database and its role, the API and BFF workloads, Ingress, CloudFront, WAF | In that bucket |

Three stacks rather than one because the `kubernetes`, `helm` and `postgresql`
providers are configured from a cluster and a database that do not exist until
`01-infra` has run. A provider configured from a resource created in the same
apply cannot be planned against an empty state and cannot be destroyed at all.

## Naming

Every resource name is `<project>-<environment>-...`. Both are variables of
all three stacks (`project` defaults to `app`, `environment` to `dev`); set the
same values in each stack's `terraform.tfvars`. The Kubernetes namespace is
`02-platform`'s `namespace`. The SPA's base path (`app`, matching Vite's
`base: "/app/"`) is `base_path` in `02-platform/locals.tf`.

## Before you start

- **Tools, in three groups**, because they fail at different moments:
  - **Needed to apply:** Terraform >= 1.10 (the S3 backend's `use_lockfile`)
    and the AWS CLI. The `kubernetes` provider authenticates by shelling out
    to `aws eks get-token`, and the `helm` provider embeds the Helm library.
  - **Needed to build:** Docker, `git`, `jq`, a JDK 25 with Maven and Node 20+,
    all used by `infra/scripts/build-and-push.sh`.
  - **Needed to operate:** `kubectl` (within one minor of `cluster_version`)
    and `helm`.
- **A route into the VPC.** `02-platform` creates the application's database
  role through the `postgresql` provider, which connects to the private RDS
  instance directly. Apply it from a host that can reach the VPC: peer the
  VPC it lives in with `01-infra`'s `operator_vpc_*` variables, or, when a
  route already exists (VPN, a CI runner inside the VPC), admit its range with
  `operator_cidr_blocks`.
- **An OIDC client** at your identity provider for the BFF (authorization code
  flow, confidential client). Its redirect URI is only known after
  `02-platform` has created the distribution; see step 5.

### Account preflight

If the account enforces S3 Block Public Access centrally and denies
`s3:PutBucketPublicAccessBlock` (common in managed landing zones), set
`manage_public_access_block = false` in `00-bootstrap` and `01-infra`:

```bash
aws s3control get-public-access-block --account-id "$(aws sts get-caller-identity --query Account --output text)"
```

In a restrictive account, check that you may create IAM roles before the
20-minute `01-infra` apply; a denial mid-apply leaves a half-built VPC to
clean up. The IAM policy simulator does not evaluate service control policies,
so test with the real (reversible) call:

```bash
aws iam create-role --role-name app-preflight --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' --query 'Role.Arn' --output text
aws iam delete-role --role-name app-preflight
```

## Apply order

```bash
# 1 -- State bucket. Once per account and environment.
cp infra/terraform/00-bootstrap/terraform.tfvars.example infra/terraform/00-bootstrap/terraform.tfvars
terraform -chdir=infra/terraform/00-bootstrap init
terraform -chdir=infra/terraform/00-bootstrap apply
terraform -chdir=infra/terraform/00-bootstrap output -raw backend_hcl > infra/terraform/01-infra/backend.hcl
cp infra/terraform/01-infra/backend.hcl infra/terraform/02-platform/backend.hcl
```

`backend.hcl` is git-ignored: a backend block cannot read variables, so the
environment-specific bucket name lives in that file instead of in code.

```bash
# 2 -- Network, cluster, database, registries, secrets.
cp infra/terraform/01-infra/terraform.tfvars.example infra/terraform/01-infra/terraform.tfvars
# ...set project/environment/region and the operator_* access...

terraform -chdir=infra/terraform/01-infra init -backend-config=backend.hcl
terraform -chdir=infra/terraform/01-infra apply
```

```bash
# 3 -- The OIDC client credentials. Terraform created the two parameters with a
#      placeholder and ignores their value, so the real one never enters state.
PREFIX="$(terraform -chdir=infra/terraform/01-infra output -raw ssm_prefix)"
aws ssm put-parameter --overwrite --type SecureString --name "$PREFIX/oidc/client-id"     --value '<client id>'
aws ssm put-parameter --overwrite --type SecureString --name "$PREFIX/oidc/client-secret" --value '<client secret>'
```

```bash
# 4 -- Build and publish the images and the SPA. Prints the tag to deploy.
infra/scripts/build-and-push.sh
```

```bash
# 5 -- Workloads, ingress, CloudFront.
cp infra/terraform/02-platform/terraform.tfvars.example infra/terraform/02-platform/terraform.tfvars
# ...set state_bucket, image_tag (step 4), oidc_issuer_uri, and narrow allowed_cidrs...

terraform -chdir=infra/terraform/02-platform init -backend-config=backend.hcl
terraform -chdir=infra/terraform/02-platform apply
```

Then register the `oidc_redirect_uri` output as a redirect URI of the client
at the identity provider. `portal_url` is where the portal is served; a
CloudFront distribution takes a few minutes to reach `Deployed` after the apply
returns.

## Deploying a new build

```bash
infra/scripts/build-and-push.sh
terraform -chdir=infra/terraform/02-platform apply -var="image_tag=<printed tag>"
```

The script uploads the SPA and invalidates the shell on its own, so a
frontend-only change needs no `apply` at all: `--skip-maven --skip-images`.

## Runtime configuration

| Workload | Setting | Source |
| --- | --- | --- |
| API | `SPRING_PROFILES_ACTIVE=prod` | literal - `prod` refuses dev-token mode |
| API | `APP_SERVER_ADDRESS=0.0.0.0` | literal |
| API | `APP_DB_URL`, `APP_DB_USERNAME` | the RDS address and the role `02-platform` creates |
| API | `APP_DB_PASSWORD` | SSM `db/app-password`, generated by `01-infra` |
| API | `APP_AUTH_MODE=jwt`, `APP_AUTH_ISSUER_URI`, `APP_AUTH_ROLES_CLAIM` | `oidc_issuer_uri`, `roles_claim` |
| API | `APP_CORS_ALLOWED_ORIGINS` | empty - one origin, CloudFront |
| BFF | `APP_BFF_API_BASE_URL` | the API's cluster-internal Service |
| BFF | `APP_BFF_AUTH_MODE=oidc`, `APP_OIDC_ISSUER_URI` | `oidc_issuer_uri` |
| BFF | `APP_OIDC_CLIENT_ID`, `APP_OIDC_CLIENT_SECRET` | SSM `oidc/client-id`, `oidc/client-secret`, set by hand (step 3) |
| both | `APP_LOG_LEVEL` | `log_level` |

Every SSM parameter lives under `/<project>-<environment>/` and reaches the
pods through the External Secrets Operator (IRSA) as the `app-secrets`
Kubernetes Secret.

## Routing

CloudFront is the only origin the browser sees:

| Path | Goes to |
| --- | --- |
| `/app/bff/*`, `/app/health`, `/app/about` | The ALB, then the BFF (no caching) |
| `/app/assets/*` | S3, as-is - a missing bundle is a 404 |
| any other `/app/...` without a dot in the last segment | S3 `app/index.html` (client-side route) |
| `/`, `/app` | 301 to `/app/` |

The rules for the S3 half are `02-platform/spa-router.js`, a CloudFront
Function; nothing exercises them locally, where the Vite dev server and
`vite preview` serve the SPA (ADR-017). The API is not exposed at the edge.

## Things to know before this environment holds anything real

- **`allowed_cidrs` defaults to `0.0.0.0/0` and `allowed_cidrs_v6` to `::/0`.**
  The WAF web ACL filters nothing until you narrow them. Narrow both or
  neither: a WAFv2 IP set holds one address family, so a list left at its
  default still admits that whole family.
- **`cluster_endpoint_public_access_cidrs` also defaults to `0.0.0.0/0`.**
  Narrow it to the operator's egress addresses.
- **Terraform state contains the database passwords in clear text.** The
  bucket is encrypted, versioned and closed to the public; the exposure is
  Terraform's own. The OIDC client secret is not in state (step 3).
- **One BFF replica.** The BFF keeps sessions in memory (ADR-010); raising
  `bff_replicas` needs ALB stickiness or a shared session store first.
- **No Multi-AZ, one NAT gateway.** `db_multi_az`, `db_deletion_protection`
  and `single_nat_gateway` in `01-infra` are the production switches.

## The lock files are not committed

`.terraform.lock.hcl` is git-ignored here. Applies and plans often run on
different platforms (`linux_amd64` in CI, `darwin_arm64` on a laptop), and a
lock file recorded on one fails `init` on the other unless both are
registered. Pinning happens in the `required_providers` blocks instead;
commit the lock files (with `terraform providers lock -platform=...` for each
platform) if your project prefers exact provider pins.

## Tearing it down

```bash
terraform -chdir=infra/terraform/02-platform destroy
terraform -chdir=infra/terraform/01-infra destroy
```

In that order: `02-platform` owns the Ingress, and destroying the cluster
first leaves an orphaned ALB and its security group behind. `00-bootstrap` has
`prevent_destroy` on the state bucket and is meant to outlive the environment.
