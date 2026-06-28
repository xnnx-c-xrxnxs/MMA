# ADR-004: Next.js Static Export (S3 + CloudFront) Over SSR

**Status:** ACCEPTED  
**Date:** 2026-05

## Context

The template's Next.js webapp can be deployed in three modes: static export to S3 + CloudFront, Lambda container image (SSR), or ECS Fargate + ALB (SSR). The deployment mode affects cost, cold-start behaviour, edge middleware support, and operational complexity.

## Decision

The default deployment mode for the main webapp is **static export** (`output: 'export'` in `next.config.js`) deployed to S3 + CloudFront via the `infra/modules/static-webapp` Terraform module. This is the default for all environments.

## Rationale

- Zero cold starts — assets are served directly from CloudFront edge
- Near-zero cost at low traffic — S3 + CloudFront is cheaper than a Lambda or ECS container
- No server to manage, patch, or scale
- The auth flow uses a client-side session restore via `POST /auth/refresh-session` with `credentials: 'include'`, so SSR is not required for auth
- Static output is simpler to reason about — the build artifact is a directory of HTML/JS/CSS files, not a running process

## Alternatives Rejected

- **Lambda container image (SSR):** Adds cold starts, requires a Dockerfile, ECR image push, and Lambda Function URL wiring. Needed only if the app requires server-side rendering for SEO or uses `getServerSideProps`-equivalent patterns.
- **ECS Fargate + ALB (SSR):** More expensive, always-on infrastructure. Appropriate for high-traffic SSR apps but overkill for an admin/internal tool.

## Constraints

- `output: 'export'` is incompatible with Next.js Edge Middleware (`middleware.ts`) — the auth redirect must be client-side in `(protected)/layout.tsx` via `useAuth() + useRouter()`
- All API routes (`app/api/`) are disabled in static export mode — all backend calls go through the external API services
- SSR mode is available if needed: switch `next.config.js` to `output: 'standalone'`, add a Dockerfile, and set `webapp.deploymentMode = 'lambda'` in `service-registry.json`
- `NEXT_PUBLIC_*` env vars must be baked in at build time — the CD workflow injects them via `--build-arg` in the static build step
