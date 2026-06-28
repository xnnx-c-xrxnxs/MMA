---
name: infra-new-module
description: Create a new reusable Terraform child module under infra/modules/ and wire it into all environment root modules. Use this when introducing an entirely new AWS service type that the existing registry-driven for_each pattern does not cover (e.g. ElastiCache, SES, Kinesis, OpenSearch).
---

# Create a New Terraform Infrastructure Module

Canonical references:
- `infra/modules/sqs/` — simplest complete module example
- `infra/modules/monitoring/` — module using for_each internally
- `infra/environments/dev/main.tf` — how modules are composed

---

## When to Use This Skill

You need this skill only when adding an **entirely new AWS service type** that has no existing module. For adding more instances of an existing service type (another DynamoDB table, SQS queue, S3 bucket), update `service-registry.json` instead — no Terraform file edits needed.

**Use this skill for:** ElastiCache, SES, Kinesis, OpenSearch, EventBridge, Cognito triggers, WAF, etc.

**Do NOT use this skill for:** adding a DynamoDB table, SQS queue, S3 bucket, or RDS PostgreSQL DB — those are registry-driven and need only a `service-registry.json` entry.

---

## Directory Structure

Every module lives under `infra/modules/{module-name}/` with exactly three files:

```
infra/modules/{module-name}/
  main.tf       ← Resource definitions
  variables.tf  ← Input variables
  outputs.tf    ← Output values
```

---

## Step 1 — Create `main.tf`

```hcl
# ─── {ModuleName} Module ──────────────────────────────────────────────────────
# One-line description of what this module creates.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

# ─── {Resource Name} ────────────────────────────────────────────────────────

resource "aws_{service}_{resource_type}" "this" {
  name = var.name

  # ... resource-specific attributes ...

  tags = merge(var.tags, {
    Name = var.name
  })
}
```

**Rules:**
- Always include the `terraform { required_providers { } }` block.
- Always use `version = "~> 6.21"` for the AWS provider — matches the workspace version.
- Always merge `var.tags` plus a `Name` tag using `merge()`.
- Name the primary resource `"this"` if there is one of it. Use descriptive names (`"dlq"`, `"primary"`) when there are multiple.
- Add a section comment (`# ─── Section Name ──`) before each logical resource group.

---

## Step 2 — Create `variables.tf`

Every module must include at minimum:
- `name` or equivalent identifier variable
- `tags` variable (always `map(string)`, always defaults to `{}`)

```hcl
variable "name" {
  description = "Resource name (fully qualified with project-env prefix)"
  type        = string
}

# Add your module-specific variables here...
variable "some_config_option" {
  description = "What this controls and valid values"
  type        = string
  default     = "default-value"
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
```

**Rules:**
- Every variable must have a `description`.
- Provide `default` values for optional variables. Never make callers provide values they shouldn't need to think about.
- Use `bool` for feature flags, `number` for thresholds/sizes, `map(string)` for flexible maps.

---

## Step 3 — Create `outputs.tf`

Export the values that callers will need to wire the module to Lambda env vars or other resources:

```hcl
output "resource_arn" {
  description = "ARN of the created resource"
  value       = aws_{service}_{resource_type}.this.arn
}

output "resource_name" {
  description = "Name of the created resource"
  value       = aws_{service}_{resource_type}.this.name
}

# Add a connection string / URL / endpoint output if applicable
output "endpoint" {
  description = "Connection endpoint"
  value       = aws_{service}_{resource_type}.this.endpoint
}
```

**Minimum outputs to always include:**
- ARN — needed for IAM policies
- Name — needed for DLQ alarms, env var values
- Connection endpoint/URL — if the service has one

---

## Step 4 — Wire into Environment Root Modules

You must add the module block to all four environment roots:
- `infra/environments/dev/main.tf`
- `infra/environments/staging/main.tf`
- `infra/environments/prod/main.tf`
- `infra/environments/preview/main.tf`

### Option A — Singleton (one per environment, not registry-driven)

```hcl
# ─── {ModuleName} ───────────────────────────────────────────────────────────

module "{module_name}" {
  source = "../../modules/{module-name}"

  name = "${var.project_name}-${var.environment}-{resource-suffix}"
  tags = var.tags

  # pass through any other required variables
}
```

### Option B — Registry-driven (for_each from service-registry.json)

Use this when the new module type needs one instance per entry in `service-registry.json`. You must first add the relevant section to the registry structure.

```hcl
# ─── {ModuleName} (from registry) ───────────────────────────────────────────

module "{module_name}" {
  source   = "../../modules/{module-name}"
  for_each = { for item in try(local.registry.infrastructure.{registryKey}, []) : item.name => item }

  name = "${var.project_name}-${var.environment}-${each.value.name}"
  tags = var.tags
}
```

### Preview environment — add resource sizing overrides

In `infra/environments/preview/main.tf`, add reduced-size settings to keep preview costs low:

```hcl
module "{module_name}" {
  source = "../../modules/{module-name}"

  name           = "${var.project_name}-preview-${var.preview_name}-{suffix}"
  some_size_var  = 1   # minimum for preview
  tags           = var.tags
}
```

---

## Step 5 — Wire Outputs to Lambda env vars (if applicable)

If your new module produces a value that Lambda functions need (endpoint, ARN, name), add it to the Lambda modules in each environment root. Find the existing `module "api_services"` or `module "worker_services"` block and add your output to the `environment_variables` map:

```hcl
module "api_services" {
  # ... existing config ...

  environment_variables = merge(
    # ... existing env vars ...
    {
      YOUR_NEW_VAR = module.{module_name}.endpoint
    }
  )
}
```

Then add `YOUR_NEW_VAR` to the relevant service's `envVars[]` array in `.github/service-registry.json`.

---

## Step 6 — Add IAM Permissions (if applicable)

If Lambda functions need to access the new resource, add the required IAM actions to the Lambda execution role. Find the IAM policy in `infra/environments/{env}/main.tf` or the `lambda-api` / `lambda-worker` module and add a new policy statement:

```hcl
statement {
  effect    = "Allow"
  actions   = [
    "your-service:ActionOne",
    "your-service:ActionTwo",
  ]
  resources = [module.{module_name}.resource_arn]
}
```

---

## Step 7 — Update `service-registry.json` (if registry-driven)

If you chose Option B (registry-driven), add the new infrastructure section to `.github/service-registry.json`:

```json
{
  "infrastructure": {
    "yourNewResources": [
      {
        "name": "example-resource",
        "someConfig": "value"
      }
    ]
  }
}
```

---

## Naming Conventions

| Pattern | Example |
|---|---|
| Module directory | `infra/modules/elasticache/` |
| Terraform local name | `module "elasticache"` |
| Resource physical name | `"${var.project_name}-${var.environment}-{suffix}"` |
| Output names | snake_case matching the standard (e.g. `cluster_endpoint`, `cluster_arn`) |

---

## Checklist

- [ ] `main.tf` created with required provider block and tagged resources
- [ ] `variables.tf` created with descriptions and sensible defaults for all optional vars
- [ ] `outputs.tf` created with ARN, name, and connection endpoint
- [ ] Module block added to `dev/main.tf`, `staging/main.tf`, `prod/main.tf`, `preview/main.tf`
- [ ] Preview sizing reduced (smaller instance class, min capacity, etc.)
- [ ] Lambda env var wired if module produces a connection string/URL
- [ ] IAM policy updated if Lambda needs access
- [ ] `service-registry.json` updated if registry-driven
- [ ] `service-registry.env` updated with new env var key + CI value
