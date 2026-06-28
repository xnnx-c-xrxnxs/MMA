---
name: cloudfront-cdn
description: Configure or modify the CloudFront CDN modules — `cloudfront-webapp` (fronts the Next.js webapp origin) and `cloudfront-s3` (fronts S3 buckets for signed-URL file downloads). Use this when adding a custom domain (ACM + Route 53), enabling CloudFront in front of a new S3 bucket, tuning cache behavior, or troubleshooting CDN responses.
---

# CloudFront CDN Modules

Canonical references:
- `infra/modules/cloudfront-webapp/` — webapp distribution (origin is Lambda Function URL or ALB)
- `infra/modules/cloudfront-s3/` — S3 distribution with Origin Access Control (OAC), used for signed-URL downloads
- `infra/environments/dev/main.tf` — how both are wired in env roots

---

## When to Use This Skill

| Goal | Use this skill |
|---|---|
| Add a custom domain to the webapp | ✅ — extend `cloudfront-webapp` with ACM cert + alias |
| Front a new S3 bucket with CloudFront for downloads | ✅ — set `cloudfront: true` on the bucket entry in `service-registry.json` (no Terraform edit) |
| Change cache TTL / behavior on the webapp distribution | ✅ |
| Add response headers (security policy, CORS) | ✅ |
| Add a brand new distribution for a non-S3, non-webapp origin | ❌ — use `infra-new-module` skill instead |

---

## Two Modules, Two Roles

### `cloudfront-webapp`

- **One per environment** — created unconditionally in every env root.
- Origin: the webapp origin URL (`local.webapp_origin_url`) — resolves to the Lambda Function URL (dev / preview) or the ALB DNS name (staging / prod).
- Caches static `_next/static/*` assets aggressively; passes through dynamic routes.
- Provides a stable HTTPS attachment point — required because Lambda Function URLs lack a custom domain capability.

### `cloudfront-s3`

- **One per opted-in bucket.** Driven by `for_each` over `local.registry.infrastructure.s3Buckets[]` filtered by `cloudfront: true`.
- Origin Access Control (OAC) so the S3 bucket can stay fully private.
- Used for **download-side** signed URLs — long expiry, edge-cached.
- Uploads still go through S3 presigned PUT URLs directly (no CloudFront involvement, no benefit from caching writes).

---

## Adding CloudFront to a New S3 Bucket

**Zero Terraform edits required.** In `.github/service-registry.json` → `infrastructure.s3Buckets[]`, add `cloudfront: true`:

```json
{
  "name": "user-avatars",
  "cloudfront": true
}
```

The `cloudfront_s3` module's `for_each` picks it up automatically on the next `terraform apply`.

---

## Adding a Custom Domain to the Webapp

This is the only common reason to edit module files directly.

1. Provision an ACM certificate in **`us-east-1`** (CloudFront requires it).
2. Add `aliases`, `viewer_certificate.acm_certificate_arn`, and `viewer_certificate.minimum_protocol_version = "TLSv1.2_2021"` to `cloudfront-webapp/main.tf`.
3. Add a Route 53 alias record pointing the custom domain at the CloudFront distribution.
4. Update `apps/webapp` env vars and CORS allow-lists (`FE_BASE_URL` in service-registry env) for the new domain.
5. Update Cognito Hosted UI callback URLs (if SSO is enabled) to include the new domain.

---

## Architectural Rules

1. **Uploads NEVER go through CloudFront.** Presigned PUT URLs target S3 directly. CloudFront would cache nothing useful and add cost / latency.
2. **Origin Access Control (OAC) over Origin Access Identity (OAI).** All S3 distributions must use OAC — OAI is legacy.
3. **Per-environment distributions.** Never share a CloudFront distribution across environments.
4. **Custom domain certs must be in `us-east-1`.** This is a CloudFront constraint — no exceptions.
5. **Cache behavior changes need a smoke test** — invalidate (`/*`) after deploy and verify `Cache-Control` headers on the responses.

---

## Common Cache Invalidation

After a webapp deploy that changes static assets, CloudFront may serve stale HTML for a few minutes. The CD workflow already creates an invalidation for `/*` after `aws lambda update-function-code` / `aws ecs update-service`. If you need to invalidate manually:

```bash
aws cloudfront create-invalidation \
  --distribution-id $(terraform -chdir=infra/environments/dev output -raw cloudfront_webapp_distribution_id) \
  --paths "/*"
```

---

## Skills That Compose With This One

| Task | Also read |
|---|---|
| Adding a CloudFront-fronted S3 bucket | `cd-register-service` (for the registry entry) |
| Adding an entirely new CDN-style module | `infra-new-module` |
| Wiring file uploads / downloads in the webapp | `webapp-file-upload-ux` + `file-upload-s3` |
