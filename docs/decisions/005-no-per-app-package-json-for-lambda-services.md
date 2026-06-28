# ADR-005: Lambda services must not ship a per-app `package.json` with `workspace:` deps

**Status:** ACCEPTED
**Date:** 2026-05

## Context

Backend services in this repo (entries in `.github/service-registry.json` under
`apiServices[]` and `eventHandlerServices[]`) deploy as Lambda ZIP packages.
The CD packaging pipeline is:

1. `nx run {service}:build` — webpack bundles `main.js` into
   `dist/apps/{domain}/{service}/`.
2. `nx run {service}:prune-lockfile` — generates a pruned `dist/package.json`
   and `dist/pnpm-lock.yaml` for the service's production deps.
3. `nx run {service}:copy-workspace-modules` — copies workspace package source
   into `dist/workspace_modules/`.
4. `zip -r service.zip dist/...` — ZIPs the dist directory.
5. At deploy time, the CD workflow runs `npm install --omit=dev` inside the
   extracted Lambda ZIP to materialize `node_modules/` before uploading.

If a service ships a hand-rolled `apps/{domain}/{service}/package.json` with
deps like `"@mma/foo": "workspace:*"`, that file is copied unchanged into
`dist/` by webpack's `copy-webpack-plugin` and shadows whatever
`@nx/js:prune-lockfile` would have generated. The `workspace:` protocol is a
pnpm-only string — `npm install` rejects it with `EUNSUPPORTEDPROTOCOL` and
the entire deploy step fails.

This actually shipped: a fork added two services with such per-app
`package.json` files, and the failure was masked for weeks because:

- The custom executors referenced in the project.json
  (`node tools/scripts/prune-lockfile.js`) did not exist in the workspace.
- The CD step invoking them used `pnpm nx run "${svc}:prune-lockfile" || true`,
  swallowing the ENOENT.
- Build went green; deploy crashed.

The Nx plugin generator (`packages/nx-plugin/src/generators/service/`) emits
the **correct** targets out of the box using `@nx/js:prune-lockfile` and
`@nx/js:copy-workspace-modules` — and it does **not** create a per-app
`package.json`. The bug was introduced by hand-edited drift.

## Decision

For every service listed in `.github/service-registry.json`
(`apiServices[]` + `eventHandlerServices[]`):

1. The service's project.json **must** use the official Nx executors:
   - `@nx/js:prune-lockfile`
   - `@nx/js:copy-workspace-modules`
   - `nx:noop` (as the aggregator `prune` target)

   These match what `packages/nx-plugin/src/generators/service/` emits.

2. The service **must not** ship a hand-rolled `apps/{domain}/{service}/package.json`.
   `@nx/js:prune-lockfile` derives `dist/package.json` from the workspace
   lockfile — that is the only `package.json` the Lambda needs.

3. If a service has a genuine reason to ship a per-app `package.json` (e.g. an
   executable script entrypoint), every dep value must be a real version
   string. The `workspace:` protocol is forbidden in any deps section
   (`dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`).

These rules are enforced by:

- **Structural lint:** `no-workspace-protocol-in-lambda-package-json` in
  `scripts/lint-standards.ts`, toggled via `coding-standards.config.ts`. Runs
  in `ci-fast-check.yml`.
- **CD deploy-time guard:** A "Verify no workspace: protocol leaked into
  dist/package.json" step in `.github/workflows/cd-deploy.yml` and
  `.github/workflows/cd-preview-create.yml` greps `dist/apps/*/*/package.json`
  for `"workspace:` and hard-fails before the deploy job runs.
- **No silent failures:** `|| true` was removed from all `prune-lockfile` /
  `copy-workspace-modules` invocations in the CD workflows.

Webapp, mobile, and `monitoring-webapp` are **exempt** — they are not in
`service-registry.json` and have their own deploy paths (S3+CloudFront for
webapp, Lambda container image for monitoring-webapp, EAS for mobile) that do
not run `npm install` against a webpacked `dist/package.json`.

## Rationale

- The Nx plugin generator already does the right thing; codifying it as the
  only allowed pattern removes the surface for drift.
- A structural lint catches the violation in seconds on PR open, instead of
  failing the deploy job 15+ minutes into CI on `main`.
- A deploy-time grep is a cheap second line of defense for the case where
  someone disables the lint check.
- The `EUNSUPPORTEDPROTOCOL` error message is opaque enough that the original
  bug took multiple debug sessions to root-cause; making it impossible to ship
  is cheaper than improving the error message.

## Alternatives Rejected

- **Run `pnpm install --frozen-lockfile` in the Lambda ZIP instead of `npm install`.**
  Rejected: Lambda runtime images don't ship with pnpm, requiring an extra
  download step on every cold start of the deploy job. Also doesn't solve
  the underlying problem — the per-app `package.json` would still drift
  from the workspace lockfile.
- **Use `sed` in CD to rewrite `workspace:*` → real versions before deploy.**
  Rejected: re-implements `@nx/js:prune-lockfile` worse. The official executor
  already does this correctly when given a clean input.
- **Allow per-app `package.json` with `workspace:*` and resolve at deploy time.**
  Rejected: relies on every CD path (main, preview, hotfix) remembering to run
  the resolution step. The simplest safe rule is "don't ship the file".
- **Only lint, no CD guard (or vice versa).** Rejected: a developer who disables
  the lint check would silently break CD. A developer who only updates a
  package.json without re-running CI would silently break CD. Two layers cost
  almost nothing and cover both holes.

## Constraints

- New backend services **must** be scaffolded via the Nx plugin
  (`packages/nx-plugin/src/generators/service/`) so they inherit the correct
  targets. Hand-editing the generator output to add a per-app `package.json`
  with `workspace:` deps will fail `ci-fast-check.yml`.
- Editing the Nx plugin generator templates to emit a per-app `package.json`
  with `workspace:` deps requires superseding this ADR first.
- The `no-workspace-protocol-in-lambda-package-json` lint check is enabled by
  default in `coding-standards.config.ts`. Disabling it in a fork requires a
  superseding ADR.
- The CD deploy-time grep guard step must not be removed from
  `cd-deploy.yml` or `cd-preview-create.yml` without a superseding ADR.
- The `nx-microservice-scaffold` skill must continue to teach the
  `@nx/js:*` executor pattern (not the legacy `nx:run-commands` + `tools/scripts/*.js`
  shim pattern).
