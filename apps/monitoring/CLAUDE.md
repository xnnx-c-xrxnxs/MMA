# Monitoring Tool Context

This file loads automatically for any file inside the internal monitoring tool. It is the **internal-only** observability dashboard — not a pattern for production user-facing services.

---

## What This Tool Does

| Component | Purpose |
|---|---|
| `apps/monitoring/monitoring-api-service/` | NestJS API exposing CloudWatch alarms, X-Ray traces, and Lambda logs across environments. JWT-protected (single internal user). |
| `apps/monitoring/monitoring-webapp/` | Next.js dashboard. Sends every request with `Authorization: Bearer <token>` + `X-Target-Environment: dev|staging|prod` so one deployment can switch accounts. |
| `packages/monitoring-sdk/` | Lambda + X-Ray + CloudWatch SDK providers consumed by the API service. |

**Both are deployed as Lambda container images** with their own Function URLs (no shared API Gateway, no ALB).

---

## Authentication Pattern (Internal Only)

> ⚠️ Do not copy these patterns to customer-facing services.

- **Sign-in:** API issues a session token from a hardcoded user defined in Secrets Manager.
- **Storage:** Token stored in `localStorage` and read by `auth-provider.tsx`.
- **Persistence:** No refresh tokens. Token is renewed on app load by re-authenticating with stored credentials, or expires after 24h forcing re-login.

The customer-facing pattern (httpOnly cookies, refresh flow) is in `auth-api-service` — see `apps/auth/auth-api-service/` and the `auth-api-service` skill.

---

## Cross-Account Pattern

The monitoring tool runs in **one** AWS account but reads from **all** environment accounts:

```
monitoring-webapp (account: monitoring)
  ↓ Bearer token + X-Target-Environment header
monitoring-api-service (account: monitoring)
  ↓ sts:AssumeRole into target account's monitoring-readonly role
AWS APIs in target account
```

`AwsClientFactory.{cloudWatch,xRay,lambda}(targetEnv)` handles the AssumeRole transparently. New SDK clients added to the factory must follow this pattern.

---

## Adding a New View

Use the **`extend-monitoring-service`** skill. It walks through:
1. Adding a provider in `packages/monitoring-sdk/`
2. Updating IAM read-only role
3. Adding application service + controller
4. Adding webapp hook + page

---

## Deployment

Deployed via **`cd-monitoring-deploy.yml`** workflow (manual dispatch only). Triggered by the `Monitoring Deploy: Trigger` VS Code task.

The workflow does:
1. Builds Docker images (one per Lambda)
2. Pushes to ECR
3. `terraform apply` for `infra/environments/{env}/monitoring/`
4. `aws lambda update-function-code --image-uri ...`

The monitoring tool's Terraform is **separate** from the main app Terraform — it has its own state file under `s3://{bucket}/monitoring/{env}/terraform.tfstate`.

---

## Local Development

The `Monitoring: Start All` VS Code task starts both services. Locally they expect **real AWS credentials** in your shell (e.g. `aws sso login --profile dev-readonly && export AWS_PROFILE=dev-readonly`) — no LocalStack option.

---

## Key Files

- `apps/monitoring/monitoring-api-service/src/application/services/` — one service per AWS data source
- `apps/monitoring/monitoring-api-service/src/infrastructure/aws/aws-client-factory.ts` — AssumeRole logic
- `apps/monitoring/monitoring-api-service/src/presentation/guards/jwt-auth.guard.ts` — internal JWT validation
- `apps/monitoring/monitoring-webapp/src/lib/use-monitoring-api.ts` — typed fetch wrapper with auth
- `packages/monitoring-sdk/src/providers/` — provider classes (Lambda, X-Ray, CloudWatch)
- `infra/environments/{env}/monitoring/` — per-environment monitoring infra (separate from main app)

---

## Anti-Patterns

- ❌ **Don't expose monitoring data to end users.** This is for internal operators only.
- ❌ **Don't reuse `LocalAuthProvider` here** — monitoring has its own simple auth (it's not a customer service).
- ❌ **Don't skip `X-Target-Environment` header** — without it the API doesn't know which account to query.
- ❌ **Don't add CloudWatch write permissions** to the read-only role — the tool is read-only by design.
