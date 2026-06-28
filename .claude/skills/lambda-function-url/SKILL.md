---
name: lambda-function-url
description: Add or modify a Lambda Function URL — the public HTTPS endpoint exposed directly by a Lambda without API Gateway. Use this when wiring a service that should be reachable as a standalone URL (webapp Lambda mode, monitoring tool, internal admin endpoints) rather than going through the shared API Gateway.
---

# Add a Lambda Function URL

A **Lambda Function URL** is a public HTTPS endpoint backed directly by a single Lambda function. It is cheaper and simpler than API Gateway when:

- The service has a single endpoint (e.g. webapp, monitoring dashboard, admin tool)
- No request validation / throttling / caching at the gateway layer is needed
- The fully-qualified domain name `https://xxxxxxxx.lambda-url.{region}.on.aws` is acceptable

Function URLs already power:
- `infra/modules/lambda-webapp/` — webapp in dev/preview mode
- `infra/environments/{env}/monitoring/` — monitoring-api + monitoring-webapp

This skill is for adding a **new** Function URL (not modifying the existing webapp/monitoring ones).

Canonical references:
- `infra/modules/lambda-webapp/main.tf` — full Function URL example
- `infra/environments/dev/monitoring/main.tf` — Function URL with custom auth

---

## Part 1 — Decide on Authentication

| Auth type | When to use | Resource |
|---|---|---|
| `NONE` | Public endpoint (e.g. webapp). MUST be paired with explicit `aws_lambda_permission` for `lambda:InvokeFunctionUrl` to `principal = "*"`. | `authorization_type = "NONE"` |
| `AWS_IAM` | Internal-only (consumer must sign requests with SigV4). | `authorization_type = "AWS_IAM"` |

> **Critical:** With `NONE`, you MUST add the `aws_lambda_permission` rule below. Without it, the URL returns 403 Forbidden even though the function exists.

---

## Part 2 — Add the Resources

In the appropriate Terraform module (or directly in an environment root for one-off endpoints):

```hcl
resource "aws_lambda_function_url" "this" {
  function_name      = aws_lambda_function.this.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]              # or your specific frontend origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["content-type", "authorization", "x-correlation-id"]
    max_age           = 3600
  }
}

resource "aws_lambda_permission" "function_url" {
  count                  = aws_lambda_function_url.this.authorization_type == "NONE" ? 1 : 0
  statement_id           = "AllowPublicFunctionURLInvocation"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.this.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
```

For `AWS_IAM` auth, omit the permission resource — IAM does the gating.

---

## Part 3 — Output the URL

```hcl
output "function_url" {
  description = "Public HTTPS endpoint for the Lambda"
  value       = aws_lambda_function_url.this.function_url
}
```

If callers (frontend, monitoring webapp) need to know the URL, expose it via the environment root's outputs and let the CD workflow store it as a GitHub variable.

---

## Part 4 — CORS Considerations

The Function URL CORS configuration is **separate from** any CORS that NestJS applies. Both must allow the same origins/methods/headers — if either denies, the request fails.

For services using cookie-based auth (refresh tokens):

```hcl
cors {
  allow_credentials = true                    # required for httpOnly cookies
  allow_origins     = [var.frontend_origin]   # MUST be a specific origin (not "*") when credentials = true
  allow_methods     = ["GET", "POST", "OPTIONS"]
  allow_headers     = ["content-type", "authorization", "x-correlation-id"]
  expose_headers    = ["set-cookie"]
}
```

`allow_origins = ["*"]` is incompatible with `allow_credentials = true` — the browser will reject the response.

---

## Part 5 — Add CloudWatch Alarms for the Function URL

A Function URL adds two new alarm-worthy metrics:

| Metric | Why |
|---|---|
| `AWS/Lambda > UrlRequestCount` (count) | Sudden traffic spike or drop |
| `AWS/Lambda > UrlRequest4xxCount` (count) | High 4xx ratio = client/CORS issue |

Add these in `infra/modules/monitoring/main.tf` if the service is critical, or skip them if it's an internal tool.

---

## Part 6 — Update `service-registry.json` (Webapp Mode Only)

If you're switching the **webapp** to Function URL via `deploymentMode = "lambda"`, no extra registry edit is needed beyond the existing `webapp` block. The `infra/modules/lambda-webapp/` module already handles the URL + permission resources.

For a **new domain** that should expose a Function URL (instead of joining the shared API Gateway), do NOT register it in `apiServices` — register it as a custom Lambda in a dedicated environment-root resource block. See the monitoring tool wiring (`infra/environments/dev/monitoring/main.tf`) as the reference example.

---

## Part 7 — Test

```sh
# After `terraform apply` outputs the URL
URL=$(terraform output -raw function_url)
curl -i $URL/api/health
```

Expected: `200 OK` with `{ "status": "ok", "service": "..." }`.

If you get `403 Forbidden`, the `aws_lambda_permission` resource is missing or incorrect.

---

## Output Checklist

- [ ] `aws_lambda_function_url` resource added
- [ ] `aws_lambda_permission` resource added (only for `authorization_type = "NONE"`)
- [ ] CORS configuration matches frontend's expected origins
- [ ] `function_url` exposed as a Terraform output
- [ ] CloudWatch alarms wired for Url* metrics (if critical)
- [ ] `terraform plan` is clean
- [ ] `curl /api/health` returns `200`
