# Troubleshooting

Common errors during local development, testing, and deployment — with the fix.

For full debugging guidance see the **`debug-local-dev`** skill (loaded automatically by Claude Code when you describe local-dev failures).

---

## Local Development

### LocalStack containers won't start

```
Error response from daemon: Conflict. The container name "/localstack" is already in use
```

**Fix:**
```sh
docker compose down -v
docker compose up -d
```

### Service crashes with `connect ECONNREFUSED 127.0.0.1:4566`

LocalStack isn't running or `LOCALSTACK_ENDPOINT` is wrong.

**Fix:** Run **`Infra: Start All`** task. Verify `.env.local` has `LOCALSTACK_ENDPOINT=http://localhost:4566`.

### `Table 'OldSTTable' not found` (DynamoDB)

LocalStack was wiped (`docker compose down -v`) without re-running setup.

**Fix:**
```sh
pnpm run localstack:setup:force
```

### Prisma error: `Cannot find module 'libquery_engine-rhel-openssl-3.0.x.so.node'`

Webpack didn't copy the Linux engine binary into `dist/`.

**Fix (CI):** Add `pnpm prisma:{domain}:generate` step **after** `Install dependencies` in the affected workflow.

**Fix (local):** Run `npx prisma generate` from the domain package directory.

### `Service: Serve {x}` fails with `EADDRINUSE: address already in use :::3000`

Another service or stale process is holding the port.

**Fix:**
```powershell
# Windows
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Stop-Process -Id <pid>
```

```sh
# macOS / Linux
lsof -ti:3000 | xargs kill -9
```

If two services claim the same port, see the port registry in `CLAUDE.md` §7.1 and reassign one in `.env.local`.

### SQS `InvalidAddress` error from a service

The `{DOMAIN}_SQS_QUEUE_URL` env var doesn't match LocalStack's expected format.

**Fix:** URL must use the DNS-based format including the **region segment matching `DEFAULT_REGION`**:
```
http://sqs.eu-west-2.localhost.localstack.cloud:4566/000000000000/user-events
```

### Webapp tests hang and never exit

Next.js / `next/jest` keeps open handles.

**Fix:** Verify `apps/webapp/jest.config.cts` has `forceExit: true`. This is required for `nx run-many` batch mode.

### `monitoring-webapp` build fails on Windows with `EPERM: operation not permitted, symlink`

The `monitoring-webapp` uses `output: 'standalone'` which writes symlinks under `.next/standalone/node_modules/`, requiring NTFS symlink permission (admin shell or Windows Developer Mode).

> **Note:** The main `webapp` uses `output: 'export'` (static) — no symlinks, no Docker, no standalone. This issue only affects `monitoring-webapp`.

**Fix:** Set `NEXT_DISABLE_STANDALONE=true` for local Windows builds of monitoring-webapp:
```powershell
$env:NEXT_DISABLE_STANDALONE="true"; pnpm nx run monitoring-webapp:build
```
CI and Docker builds leave the var unset so `output: 'standalone'` stays enabled.

If a previous failed build left a corrupt `.next/standalone/` (broken symlinks block PowerShell `Remove-Item`), wipe it with cmd:
```powershell
cmd /c "rmdir /s /q apps\monitoring\monitoring-webapp\.next"
```

### `nvm: command not found` after fresh shell

`nvm` profile script wasn't loaded.

**Fix:** Re-source your shell profile (`source ~/.zshrc` / `source ~/.bashrc`) or restart the terminal.

The CI/CD workflows set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` to handle this on GitHub-hosted runners — no local action needed.

---

## Testing

### Coverage threshold failures locally pass but fail in CI

CI uses fresh nodes — local Nx cache may hide a regression.

**Fix:**
```sh
pnpm nx test {project} --skip-nx-cache --coverage
```

### E2E tests pass locally, fail in CI with `Cannot find table OldSTTable_E2E_Users`

CI didn't run `setup-e2e.ts`.

**Fix:** Verify `.github/workflows/ci-e2e.yml` has the `Setup E2E infrastructure` step before the test step.

### Playwright tests fail with `expect(locator).toBeVisible() — Element not found`

The component is missing a `data-testid` attribute.

**Fix:** Add the testid following the convention in `apps/webapp-e2e/src/utils/selectors.ts`. See Golden Rule #44 in `CLAUDE.md`.

### `nx affected --target=test` returns no projects when you expected affected

Nx SHA detection is wrong.

**Fix:**
```sh
NX_BASE=origin/main NX_HEAD=HEAD pnpm nx affected --target=test
```

In CI, `nrwl/nx-set-shas@v4` requires `permissions: { actions: read }` at the workflow level (see `CLAUDE.md` §7.1).

---

## Deployment

### `terraform apply` fails with `Error: BucketAlreadyOwnedByYou`

State bucket from a previous bootstrap exists. Either reuse it or use a different `environment` suffix.

**Fix:**
```sh
cd infra/bootstrap
terraform init -reconfigure
terraform import aws_s3_bucket.tfstate <existing-bucket-name>
```

### Lambda fails with `Cannot find module './main'` after deploy

Webpack output is missing `libraryTarget: 'commonjs2'` or `run.sh` is missing.

**Fix:** 
1. Verify `apps/{domain}/{service}/webpack.config.js` has `libraryTarget: 'commonjs2'` in the `output` block.
2. Verify the CD workflow creates `run.sh` in the dist directory before zipping.

### Webapp Docker build fails with `COPY apps/webapp/package.json: not found`

`apps/webapp/package.json` is missing.

**Fix:** Create a minimal `apps/webapp/package.json` (even with just `{ "name": "webapp", "version": "0.0.0" }`). The Dockerfile relies on it for npm layer caching.

### `terraform apply` fails: `aws_lambda_function: ... runtime: nodejs20.x is not supported`

Some Lambda still references Node 20.

**Fix:** Search for `nodejs20.x` in `infra/` — replace with `nodejs24.x`. The repo standard is **Node 24** (see Golden Rule §9 of `CLAUDE.md`).

### CD workflow fails: `Error: Resource not accessible by integration`

Workflow uses `nrwl/nx-set-shas@v4` without proper permissions.

**Fix:** Add to the workflow file:
```yaml
permissions:
  actions: read
  contents: read
```

### Webapp deployment-mode switch destroys the wrong module

Switching `deploymentMode` in `service-registry.json` from `ecs` → `lambda` (or vice versa) makes Terraform tear down the unused module.

**Fix:** This is intentional. To preserve a DNS endpoint when switching modes, point Route 53 at the *new* endpoint **before** the switch and keep DNS TTL low.

### Slack notifications never arrive after deploy

The Slack workspace OAuth handshake wasn't completed.

**Fix:** See [notifications.md §First-Time Setup](notifications.md#first-time-setup) — AWS Chatbot requires a manual one-time Slack OAuth approval per AWS account.

---

## When to Open an Issue

If a problem isn't covered here:

1. Check the **`debug-local-dev`** skill at `.claude/skills/debug-local-dev/SKILL.md`.
2. Search existing issues.
3. Open a new issue with:
   - The exact command run
   - Full error output
   - Output of `node --version`, `pnpm --version`, `docker --version`
   - The contents of `.env.local` with secrets redacted
