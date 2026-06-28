# Cost Transparency

Estimated **monthly AWS spend** for a project bootstrapped from this template, by environment. Numbers are rough order-of-magnitude — actual bills depend on traffic, region, reserved-capacity discounts, and how aggressively you scale resources up.

All figures assume **eu-west-2** (London) at on-demand pricing as of 2025 H2. Use the [AWS Pricing Calculator](https://calculator.aws/) for a binding estimate.

## TL;DR per environment

| Environment | Idle / minimal traffic | Light production traffic |
|---|---|---|
| **Preview** (per active preview) | ~$15–25 / month | n/a — ephemeral |
| **Dev** | ~$50–80 / month | ~$80–120 / month |
| **Staging** | ~$100–150 / month | ~$150–250 / month |
| **Prod** | ~$200–300 / month | $400+ / month, scales with traffic |

Per-AWS-account fixed cost: ~**$5–10 / month** for CloudWatch logs retention, Secrets Manager, Route 53 hosted zone (if you bring a custom domain).

## Per-resource breakdown (production baseline)

### Compute

| Resource | Notes | Est. $/month |
|---|---|---|
| **Lambda** (all backend services) | 2M invocations, 512 MB avg, 200 ms avg duration | $5–20 |
| **S3 + CloudFront** (static webapp, all envs) | 10 GB stored, 2M requests/month | ~$1–3 |
| **API Gateway HTTP API** | 2M requests | $2 |

> **The webapp uses static export by default** — no ECS Fargate, no Lambda Function URL, no ALB. CloudFront serves pre-built HTML/CSS/JS globally with zero cold-start latency.

### Persistence

| Resource | Notes | Est. $/month |
|---|---|---|
| **DynamoDB** (on-demand) | Single table per env, light traffic | $1–5 |
| **RDS PostgreSQL** (`db.t4g.micro`, dev) | Single AZ, no reserved instance | ~$15 |
| **RDS PostgreSQL** (`db.t4g.medium`, prod) | Multi-AZ recommended (~2× single-AZ) | ~$60 single-AZ / $120 multi-AZ |
| **S3** (file storage) | 10 GB stored, 100 K requests | $1–2 |

> **The biggest variable is RDS.** If your domain is DynamoDB-only, you can remove the RDS module from `infra/environments/{env}/main.tf` and save $15–120/month per env. The template lets each domain pick its persistence — so don't pay for Postgres if no domain needs it.

### Networking

| Resource | Notes | Est. $/month |
|---|---|---|
| **NAT Gateway** | 1 per env (Lambda-in-VPC reaches RDS through it) | ~$32 + $0.045/GB |
| **ALB** (webapp ECS mode, prod) | Always-on | ~$18 |
| **CloudFront** | If wired (cloudfront-webapp module) | $1–10 depending on traffic |
| **Data transfer out** | First 100 GB free / month | $0–9 / 100 GB after |

> **NAT Gateway is the silent cost killer.** It's ~$32/month per env even at zero traffic. If your env has no Lambda-in-VPC services (i.e. no Prisma/RDS), you can omit the NAT entirely. The template only creates NAT in environments that have `requiresVpc: true` services.

### Observability

| Resource | Notes | Est. $/month |
|---|---|---|
| **CloudWatch Logs** (14-day retention dev, 90-day prod) | $0.50/GB ingested + storage | $5–30 |
| **CloudWatch Alarms** | 10 alarms × $0.10 = $1 | ~$1 |
| **X-Ray** | First 100 K traces free, then $5/M | $0–10 |
| **SNS** (notifications) | First 1000 emails/month free | ~$0 |

### Security & Auth

| Resource | Notes | Est. $/month |
|---|---|---|
| **Cognito** (User Pool) | Free up to 50 K MAU | $0 (free tier) |
| **Secrets Manager** | 1 secret per env, $0.40/secret + API calls | ~$1 |
| **KMS** (default keys) | Free tier covers most projects | $0–1 |
| **WAF** (if enabled) | $5 / web ACL + $1/M requests | $0 unless wired |

## How to reduce cost

### Quick wins

1. **Single-AZ RDS** for staging — the template defaults to single-AZ; only enable multi-AZ for prod.
2. **Lambda mode for non-prod webapp** — already the default in `service-registry.json`.
3. **14-day log retention** for dev/preview — already the default.
4. **Drop unused environments** — preview environments cost $15–25/month each; destroy them aggressively via `Preview: Destroy`.
5. **Remove NAT if no VPC-bound Lambdas** — if all your domains use DynamoDB, you don't need RDS, the VPC, or the NAT.
6. **Disable CloudFront in dev/preview** — the `cloudfront-webapp` module is per-env opt-in.
7. **DynamoDB on-demand vs provisioned** — on-demand is cheaper at low/spiky traffic; switch to provisioned + auto-scaling once you have predictable load.

### Spend visibility

Enable **AWS Cost Anomaly Detection** in the AWS Console (free) — it'll alert when an env's spend deviates from baseline. Tag every Terraform-managed resource with `Project = "{project_name}"` and `Environment = "{env}"` (the modules already do this) so you can split bills cleanly.

## Per-account separation (recommended)

The template supports **one AWS account per environment** (dev/staging/prod). Benefits:

- Hard blast radius — a runaway Lambda in dev cannot affect prod
- Per-environment IAM/Org policies
- Per-environment cost dashboards out of the box
- Clean credentials story (no cross-account roles needed for normal CI/CD)

Trade-off: **3 accounts × per-account fixed cost** (~$15–30/month total) instead of one. Worth it for production work.

See [docs/bootstrap.md](bootstrap.md) for the multi-account setup flow.
