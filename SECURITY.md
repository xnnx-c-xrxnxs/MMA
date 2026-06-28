# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue in this template (or in a downstream project bootstrapped from it), report it privately:

- Use **GitHub Security Advisories**: https://github.com/xnnx-c-xrxnxs/mma/security/advisories/new
- Or email the maintainers at: **security@mma-labs.example** _(replace with your team's contact when bootstrapping)_

Please include:
- A clear description of the vulnerability
- Steps to reproduce (or a proof-of-concept)
- The affected component (template script, infra module, package, or generated code)
- Suggested mitigation if you have one

We aim to acknowledge reports within **3 business days** and provide a remediation plan within **10 business days** for confirmed issues.

## Supported Versions

This is a project template — only the `main` branch receives security updates. Downstream projects bootstrapped from a given commit are responsible for their own backports.

## Scope

In scope:
- Template scripts (`scripts/`, `infra/`)
- Workspace packages (`packages/`)
- Reference services (`apps/auth/`, `apps/files/`, `apps/monitoring/`, `apps/webapp/`, `apps/mobile/`)
- Default Terraform modules and CD workflows

Out of scope:
- Third-party dependencies (report to upstream maintainers — we will track and bump)
- Vulnerabilities in `examples/` (reference-only code, removed by `init-project.mjs`)
- Issues only reproducible with non-default configuration (e.g. disabling JWT auth)

## Security Baseline

This template ships with the following security controls enabled by default:

| Control | Where | Notes |
|---|---|---|
| **GitHub-native code scanning** | Repo settings | Enable CodeQL default setup in Security tab — zero-config, runs on PRs |
| **Dependabot** version updates | `.github/dependabot.yml` | Weekly grouped PRs for npm + GitHub Actions + Terraform + Docker |
| **Secret scanning + push protection** | GitHub-native | Enable in repo settings after bootstrap |
| **Template hygiene gate** | `.github/workflows/ci-fast-check.yml` (`template-hygiene.mjs` step) | Fails if real PATs / AWS keys / tfstate land in tracked files |
| **API Gateway JWT authorizer** | `infra/modules/api-gateway` | Two-tier auth (gateway + NestJS guard) |
| **Refresh tokens as httpOnly cookies** | `apps/auth/auth-api-service` | Never readable from JS |
| **AWS OIDC for CD** | `infra/bootstrap` | No long-lived AWS credentials in GitHub secrets |
| **`@mma/eslint-plugin`** custom rules | `packages/eslint-plugin` | Bans `process.env.NODE_ENV === 'development'` etc. |
| **Structural lint** | `scripts/lint-standards.ts` | Enforces Clean Architecture boundaries |

## After Bootstrapping a New Project

When you run `node scripts/init-project.mjs`:

1. **Rotate the example contact email** in this `SECURITY.md` to your team's actual security inbox.
2. **Enable GitHub repo settings** → Code security and analysis:
   - Secret scanning + push protection
   - Dependency graph + Dependabot alerts
   - Code scanning → CodeQL **default setup** (one click, no workflow file needed)
3. **Review IAM scope** in `infra/bootstrap/main.tf` — the default deploy role has broad permissions appropriate for greenfield work; tighten before production.
4. **Set up branch protection** on `main` and `develop` per [CLAUDE.md §15](CLAUDE.md).
