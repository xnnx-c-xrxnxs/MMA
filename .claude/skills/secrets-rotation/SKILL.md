---
name: secrets-rotation
description: Rotate AWS Secrets Manager secrets used by backend services (database passwords, API tokens, JWT signing keys, Expo Push tokens, etc.) without downtime. Use this when scheduled rotation is overdue, a credential is suspected of being leaked, or you are introducing a new rotatable secret.
---

# Rotating Secrets in AWS Secrets Manager

Canonical references:
- `packages/aws/aws-secrets/` — `SecretsConfig.resolve()` consumer pattern
- `infra/modules/secrets/` — Terraform module that creates per-environment secrets

---

## When to Use This Skill

| Scenario | Use this skill |
|---|---|
| Quarterly / scheduled rotation of an existing secret | ✅ |
| Emergency rotation after a suspected leak | ✅ |
| Adding a brand new rotatable secret | ✅ |
| Adding a one-off non-rotatable secret (e.g. third-party API key for a single integration) | ✅ — but skip the rotation function part |
| Reading a secret in a Lambda for the first time | ❌ — see `packages/aws/CLAUDE.md` (`aws-secrets` package) |

---

## Project-Level Secret Convention

This template uses **one Secrets Manager secret per environment** at the project level — not one per service. Services declare which keys they need via `SecretsConfig.resolve(['KEY1', 'KEY2'])` at Lambda cold-start, and only those keys are written to `process.env`. This keeps IAM policies simple (one ARN per env) and the secret payload central.

```jsonc
// Example payload of <project>-<env>-secrets in Secrets Manager
{
  "ORDERS_DATABASE_URL": "postgresql://...",
  "JWT_SIGNING_KEY":     "...",
  "EXPO_PUSH_TOKEN":     "..."
}
```

---

## Routine Rotation (Zero Downtime)

The two-stage flow is **store new value → wait for cold-starts → revoke old value**. Lambda cold-starts re-resolve secrets, so no service restart is needed.

### Step 1 — Stage the new value

```powershell
# 1. Compute / generate the new value (example: rotate JWT signing key)
$newKey = [Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }))

# 2. Read current secret
$current = aws secretsmanager get-secret-value `
  --secret-id "myproject-prod-secrets" `
  --query SecretString --output text | ConvertFrom-Json

# 3. Update the single key, preserving everything else
$current.JWT_SIGNING_KEY = $newKey

# 4. Push the new payload
$payload = $current | ConvertTo-Json -Compress
aws secretsmanager put-secret-value `
  --secret-id "myproject-prod-secrets" `
  --secret-string $payload
```

### Step 2 — Force re-resolution

Cold-starts pick up the new value automatically, but you can force it for all currently-warm Lambdas by republishing them:

```powershell
# List all functions for the env (uses service-registry.json)
$services = Get-Content .github/service-registry.json | ConvertFrom-Json
foreach ($svc in $services.apiServices + $services.eventHandlerServices) {
  $fn = "myproject-prod-$($svc.name)"
  Write-Host "Forcing cold-start for $fn"
  aws lambda update-function-configuration `
    --function-name $fn `
    --environment "Variables={SECRET_ROTATED_AT=$(Get-Date -Format o)}"
}
```

This updates a no-op env var, which Lambda treats as a config change and triggers a fresh cold-start on the next invocation.

### Step 3 — Verify

For each affected service:
1. Hit `GET /api/health` — confirm 200.
2. Hit one authenticated endpoint — confirm the new key is accepted (for JWT rotation) or the new credential works (for DB rotation).
3. Inspect CloudWatch Logs for the cold-start log line — `SecretsConfig` logs which keys it resolved (NOT the values).

### Step 4 — Revoke the old value

For credentials with an external "old vs new" notion (DB users, API tokens):
- Revoke / delete the old credential at the source (DB user drop, API token revoke).
- For JWT signing keys with rolling validation: keep the previous key in a `JWT_PREVIOUS_KEYS` array for the access-token TTL (typically 15 min) so in-flight tokens still validate, then remove.

---

## RDS Master Password Rotation

RDS allows in-place password change via the AWS API:

```powershell
$newPassword = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# 1. Update Secrets Manager FIRST
$current = aws secretsmanager get-secret-value --secret-id "myproject-prod-secrets" --query SecretString --output text | ConvertFrom-Json
$current.ORDERS_DATABASE_URL = $current.ORDERS_DATABASE_URL -replace '://[^:]+:[^@]+@', "://dbuser:$newPassword@"
aws secretsmanager put-secret-value --secret-id "myproject-prod-secrets" --secret-string ($current | ConvertTo-Json -Compress)

# 2. Update the RDS master password
aws rds modify-db-instance `
  --db-instance-identifier myproject-prod-orders `
  --master-user-password $newPassword `
  --apply-immediately

# 3. Force Lambda cold-starts (Step 2 above)
```

**Order matters** — update Secrets Manager BEFORE RDS so newly-cold Lambdas can connect with the new password the moment RDS finishes the modify.

---

## Adding a Brand New Secret

1. Decide the key name — UPPER_SNAKE_CASE, prefixed by the consuming domain when applicable (e.g. `EXPO_PUSH_TOKEN`, `ORDERS_DATABASE_URL`).
2. Add it to the Secrets Manager payload via `aws secretsmanager put-secret-value` (preserving existing keys).
3. In the consuming service's `main.ts`, add the key to the resolve call:
   ```ts
   await SecretsConfig.resolve(['ORDERS_DATABASE_URL', 'EXPO_PUSH_TOKEN']);
   ```
4. Reference `process.env.EXPO_PUSH_TOKEN` from the service config.
5. **Do NOT add the secret value to `service-registry.env` or `.env.local`.** For local dev, use a placeholder or a separate dev account credential.

---

## Architectural Rules

1. **Never log secret values.** Loggers in `@old-st/telemetry` redact common patterns, but do not depend on this — never `logger.info({ secret })`.
2. **Never commit a secret.** `.gitignore` covers `.env.local` and `.env.e2e`, but a `.env.production` accidentally committed to a feature branch is a leak. Run `git secrets --scan` before pushing if unsure.
3. **One Secrets Manager secret per environment.** No per-service secrets. Per-service IAM scoping is done via the resolve allow-list, not multiple ARNs.
4. **Rotation requires a cold-start.** Lambda runtime caches `process.env` — there is no "hot reload" mechanism here.
5. **Track rotation dates.** Add a calendar reminder per secret. Quarterly is the minimum cadence for production credentials.
6. **Emergency rotation skips Step 4 and revokes the old credential immediately.** Some users will get 401s for the access-token TTL — that is the expected blast radius.

---

## Skills That Compose With This One

| Task | Also read |
|---|---|
| Reading a secret in a service for the first time | `packages/aws/CLAUDE.md` |
| Adding a new RDS-backed domain | `prisma-service-wiring` |
| Adding a credential for a third-party integration (Expo Push, etc.) | `notification-domain` |
| Setting up the Secrets Manager secret in Terraform | `infra-new-module` (only if changing the `secrets` module itself) |
