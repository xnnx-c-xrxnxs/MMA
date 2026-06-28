# Bug: Bootstrap Local State Collision in Multi-Account Setups

## Problem

The `infra/bootstrap/` module uses **Terraform local state** (no remote backend — it creates the remote backend for everything else). All three bootstrap scripts (`bootstrap-apply.mjs`, `setup-github-all-vars.mjs`, and the init/plan tasks via `load-creds-and-run.mjs`) read from and write to a **single shared state file**: `infra/bootstrap/terraform.tfstate`.

In a multi-account deployment (separate AWS accounts for dev, staging, prod), this causes a **critical cross-account state collision**:

1. Developer bootstraps the **dev** account → `terraform.tfstate` contains dev resources (OIDC provider, deploy role, S3 bucket, ECR repo — all in dev account `111111111111`).
2. Developer then bootstraps the **prod** account → Terraform loads the same `terraform.tfstate`, sees dev resources, and attempts to **refresh** them using **prod** credentials.
3. This fails with `AccessDenied` because prod IAM credentials cannot read IAM resources in the dev account:
   ```
   Error: reading IAM OIDC Provider (arn:aws:iam::111111111111:oidc-provider/token.actions.githubusercontent.com):
   operation error IAM: GetOpenIDConnectProvider, StatusCode: 403, AccessDenied:
   User: arn:aws:sts::222222222222:assumed-role/.../user is not authorized to access this resource
   ```
4. The `setup-github-all-vars.mjs` script extracts `AWS_ACCOUNT_ID` from `terraform output deploy_role_arn`. Since it reads the wrong state file, it **pushes the dev account ID into the prod GitHub environment** — causing CD deployments to target the wrong AWS account.

**This is a critical issue** because:

- Bootstrap is completely broken for any account after the first one — you cannot init, plan, apply, or read outputs for a different account.
- If the `setup-github-all-vars.mjs` script runs against the wrong state, it **silently overwrites** GitHub environment variables with values from the wrong AWS account. The CD pipeline would then deploy prod workloads to the dev account (or vice versa) with no error until runtime.
- There is no warning or error message indicating the state mismatch — it either fails with a cryptic IAM 403 or succeeds with wrong data.

---

## Solution

Each environment must get its own state file: `terraform.{env}.tfstate` (e.g., `terraform.dev.tfstate`, `terraform.prod.tfstate`). Terraform's `-state` flag enables this without changing the backend configuration.

### Files to modify

#### 1. `scripts/task-helpers/bootstrap-apply.mjs`

This script runs `terraform apply`, `plan`, and `import` commands. All must receive `-state=terraform.{env}.tfstate`.

After loading credentials and before running terraform commands, derive the state file from the environment argument:

```javascript
const stateFile = `terraform.${credEnv}.tfstate`;
```

Then append `-state=${stateFile}` to every terraform command in the script:

```javascript
// apply
runInherited(`terraform -chdir=infra/bootstrap apply -state=${stateFile}`);

// plan (in isOidcConflict check)
run(`terraform -chdir=infra/bootstrap plan -state=${stateFile} -no-color 2>&1`, ...);

// import (in importOidcProvider)
runInherited(
  `terraform -chdir=infra/bootstrap import -state=${stateFile} aws_iam_openid_connect_provider.github ${arn}`
);
```

#### 2. `scripts/task-helpers/setup-github-all-vars.mjs`

This script runs `terraform output` to read bootstrap outputs. It must read from the correct env state file.

After extracting `region` and `projectName`, derive the state file from the environment name:

```javascript
const stateFile = `terraform.${envName}.tfstate`;

const outputsRaw = execSync(
  `terraform -chdir=infra/bootstrap output -state=${stateFile} -json`,
  { encoding: 'utf-8', env: process.env, cwd: root }
);
```

#### 3. Create `scripts/task-helpers/bootstrap-cmd.mjs` (new file)

A generic wrapper for running any terraform bootstrap subcommand with the correct credentials AND state file. This replaces the use of `load-creds-and-run.mjs` for bootstrap tasks (init, plan, etc.).

```
Usage: node scripts/task-helpers/bootstrap-cmd.mjs <env> <terraform-subcommand> [...args]
```

The script:

- Loads credentials from `infra/bootstrap/aws-credentials.{env}` (with fallback to `aws-credentials`).
- For commands that accept `-state` (`plan`, `apply`, `output`, `import`, `destroy`, `refresh`, `state`, `taint`, `untaint`, `show`), injects `-state=terraform.{env}.tfstate` automatically.
- For commands that don't need state (`init`, `providers`, `fmt`, `validate`), runs them as-is.

#### 4. `.vscode/tasks.json` — Update Bootstrap Init and Plan tasks

Replace `load-creds-and-run.mjs` with `bootstrap-cmd.mjs`:

```jsonc
// Before (broken for multi-account):
"command": "node scripts/task-helpers/load-creds-and-run.mjs ${input:credentialsEnv} terraform -chdir=infra/bootstrap init"
"command": "node scripts/task-helpers/load-creds-and-run.mjs ${input:credentialsEnv} terraform -chdir=infra/bootstrap plan"

// After (state-isolated):
"command": "node scripts/task-helpers/bootstrap-cmd.mjs ${input:credentialsEnv} init"
"command": "node scripts/task-helpers/bootstrap-cmd.mjs ${input:credentialsEnv} plan"
```

#### 5. One-time migration — Rename existing state file

The existing `terraform.tfstate` contains the first bootstrapped account's resources. Rename it to match the new naming convention:

```bash
mv infra/bootstrap/terraform.tfstate infra/bootstrap/terraform.dev.tfstate
mv infra/bootstrap/terraform.tfstate.backup infra/bootstrap/terraform.dev.tfstate.backup  # if exists
```

### No gitignore changes needed

The existing `.gitignore` already covers `*.tfstate` and `*.tfstate.*`, so `terraform.{env}.tfstate` files are automatically ignored.

---

## Verification

After applying the fix:

1. Run `AWS: Bootstrap Init` → select `dev` → should succeed (no state read needed).
2. Run `AWS: Bootstrap Apply` → select `dev` → should use `terraform.dev.tfstate`.
3. Run `AWS: Bootstrap Init` → select `prod` → should succeed.
4. Run `AWS: Bootstrap Apply` → select `prod` → should create `terraform.prod.tfstate` with prod resources only.
5. Run `AWS: Setup GitHub Variables` → select `prod` → should read `terraform.prod.tfstate` and push the correct prod account ID.
