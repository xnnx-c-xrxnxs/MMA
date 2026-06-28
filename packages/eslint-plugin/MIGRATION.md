# @old-st/eslint-plugin — Migration Guide

This file documents breaking changes and new rules across plugin versions.
Projects forked from the template should reference this when updating.

---

## v1.0.0 (March 2026) — Initial Release

### New Rules

| Rule | Severity | Description |
|---|---|---|
| `@old-st/no-bare-contracts-import` | error | Ban bare `@old-st/contracts` imports — use domain subpaths |
| `@old-st/no-domain-framework-imports` | error | Ban `@nestjs/*`, `zod`, `express`, `@aws-sdk/*` in domain layer |
| `@old-st/no-prisma-client-in-domain` | error | Ban `@prisma/client` outside infrastructure |
| `@old-st/no-contracts-in-use-cases` | error | Ban `@old-st/contracts/*` in use-case files |
| `@old-st/no-direct-fetch-in-components` | error | Ban direct `fetch()`/`axios` in frontend components |
| `@old-st/no-hardcoded-status-strings` | error | Flag hardcoded status/role strings in domain files |
| `@old-st/enforce-service-boundary` | error | Controllers must only import from application/services |
| `@old-st/no-node-env-development` | error | Ban `NODE_ENV === 'development'` checks |
| `@old-st/require-event-handler-service` | error | Events must be in dedicated event-handler-service |
| `@old-st/require-file-api-service` | **off** | File ops via file-api-service (enable when ready) |

### Preset Configs

| Config | Description |
|---|---|
| `recommended` | All rules as `error` except `require-file-api-service` (off) |
| `strict` | All rules as `error` including `require-file-api-service` |
| `relaxed` | Core import rules as `error`, pattern rules as `warn` |

### Migration Steps for Existing Projects

1. Install: plugin ships with the template workspace — no extra install needed
2. Update `eslint.config.mjs`:
   ```js
   import oldStPlugin from '@old-st/eslint-plugin';
   // Add the plugin to your existing config
   ```
3. Run `pnpm nx lint --all` to find violations
4. **If many violations:** start with `relaxed` config, fix errors first, then promote warnings to errors
5. **If few violations:** use `recommended` directly

### Known Migration Issues

- **`no-hardcoded-status-strings`**: May flag legitimate string literals in test fixtures or seed data. Add `allowed: [...]` option or exclude test files via ESLint `ignores`.
- **`no-direct-fetch-in-components`**: May flag `fetch` in SSR `getServerSideProps`-style functions. Add the file to `allowedFiles` option.
- **`enforce-service-boundary`**: Only checks `presentation/controllers/` file paths. Custom controller locations need adjusting.

---

## Upgrade Template

When pulling updates from the template, new rules may be added. Follow this process:

1. Check this file for new entries since your last update
2. New rules default to `'warn'` in `relaxed` config for one version cycle
3. After one version, they promote to `'error'` in `recommended`
4. Override in your project's `eslint.config.mjs` if needed
