# Project Context

> **Purpose:** This file gives the AI Issue Creator (and any AI assistant working on issues) a fast, factual snapshot of this codebase. The AI **must** read this file at the start of every session.
>
> When the answer to a question is "see `CLAUDE.md`", that file is the deeper source of truth. This file is the index.

---

## 1. What This Project Is

`mma` is a **full-stack Clean Architecture template** for AWS-deployed products. It ships:

- **Backend microservices** — NestJS on Lambda (HTTP API services + SQS event-handler services).
- **Webapp** — Next.js 15 App Router (Tailwind v4, shadcn-style UI primitives, React Query).
- **Mobile app** — Expo / React Native (shared data-access layer with the webapp via `@mma/client-common`).
- **CD pipeline** — Terraform child modules driven by `.github/service-registry.json` (zero-edit deploys for new services).
- **Workflow prompts + skills** — `.claude/commands/` and `.claude/skills/` automate Clean Architecture-compliant feature development.

---

## 2. Bounded Contexts (Domains)

> **Source of truth:** [.github/issue-config.json](../.github/issue-config.json) — `domains[]` and `crossCutting[]`.
> The table below is the human-readable view. **When you add or remove a domain, edit `issue-config.json` first**, then re-run `node scripts/task-helpers/setup-github-labels.mjs` and update this table + the `Domain` dropdown in `.github/ISSUE_TEMPLATE/*.yml`.

| Domain | Persistence | Service(s) |
|---|---|---|
| `user` | DynamoDB OneTable | `user-api-service`, `user-event-handler-service` |
| `product` | DynamoDB OneTable | `product-api-service`, `product-event-handler-service` |
| `order` | Prisma + PostgreSQL | `order-api-service`, `order-event-handler-service` |
| `auth` | Cognito (deployed) / `LocalAuthProvider` (local) | `auth-api-service` |
| `files` | S3 (presigned URLs) | `file-api-service` |
| `monitoring` | CloudWatch / X-Ray | `monitoring-api-service`, `monitoring-webapp` (internal tool) |

**Cross-cutting surfaces** (not bounded contexts, but valid `domain-*` labels):
`webapp`, `mobile`, `infra`, `cross-domain`, `new-domain`.

Add new domains via the `/new-domain` workflow prompt — and remember the `issue-config.json` + dropdown sync.

---

## 3. User Roles

- `ADMIN` — full access, manages users.
- `USER` — standard authenticated end user.
- `GUEST` — pre-auth public flows only (sign-in, sign-up, public catalogue).

Role enums live in `packages/{auth-domain}-domain/src/domain/constants/{auth-domain}-roles.ts` — never hardcode role strings.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | NestJS 11 |
| Runtime | Node.js 24 (Lambda `nodejs24.x`) |
| Validation | Zod (in `packages/contracts/{domain}/`) |
| Persistence (NoSQL) | DynamoDB OneTable v2 |
| Persistence (SQL) | Prisma 5 + PostgreSQL 16 (RDS) |
| Auth | AWS Cognito (deployed), JWT JWKS verification |
| Eventing | SQS Standard + FIFO via `@mma/aws-sqs` |
| Telemetry | OpenTelemetry + structured JSON logs (`@mma/telemetry`) + CloudWatch + X-Ray |
| Webapp | Next.js 15 App Router, Tailwind v4, shadcn primitives, React Query, react-hook-form + Zod resolver |
| Mobile | Expo SDK 52, Expo Router, React Query, `@mma/mobile-ui` primitives |
| IaC | Terraform (child modules + per-environment roots) |
| CI/CD | GitHub Actions, GitHub OIDC → AWS, Nx affected |
| Monorepo | Nx 19 + pnpm workspaces |

---

## 5. Architectural Rules That Affect Every Issue

The full list is in [CLAUDE.md](../CLAUDE.md) — Golden Rules #1–#46. Highlights every BA / dev / AI must respect when scoping issues:

- **Clean Architecture layering** — Presentation → Application → Use Cases → Domain → Infrastructure. Inner never depends on outer.
- **Application services always exist** — controllers never call use cases directly.
- **Contracts via subpath imports only** — `@mma/contracts/{domain}`, never bare `@mma/contracts`.
- **Pagination per persistence** — DynamoDB → cursor; Prisma → offset. Never mix within a domain.
- **Authenticated actor from JWT only** — `@CurrentUser()` decorator, never from request body.
- **Refresh tokens are httpOnly cookies; access tokens memory-only** (no localStorage).
- **All file uploads/downloads go through `file-api-service` via S3 presigned URLs** — domain services never touch S3.
- **Structured logging via `createLogger()` from `@mma/telemetry`** — never `new Logger()` from `@nestjs/common`.
- **CorrelationId propagated across HTTP + SQS** — via `correlationMiddleware()` and `getOutboundHeaders()`.
- **Service registry-driven CD** — adding a service = editing `.github/service-registry.json`, not Terraform `.tf` files.

---

## 6. Workflow Prompts (Choose One per Issue)

| Issue scope | Prompt |
|---|---|
| New bounded context | `/new-domain` (or `/new-domain-dynamo`, `/quick-crud-domain`) |
| New feature in existing backend domain | `/new-feature` |
| Backend + webapp + mobile slice | `/full-stack-feature` |
| Webapp page only | `/webapp-feature` |
| New microservice | `/new-service` |
| SQS publisher / consumer / saga | `/new-event-service` |
| Single use case | `/new-use-case` |
| E2E tests | `/new-e2e-tests` |
| New shared UI primitive | `/new-ui-primitive` |
| Accessibility audit | `/fe-accessibility-pass` |
| Mobile release | `/mobile-release` |
| Push notifications | `/add-push-notifications` |
| Monitoring tool feature | `/add-monitoring-feature` |
| New alarm channel | `/add-alerting` |
| Sprint triage / bundling | `/triage-sprint` |

The full list with trigger phrases is in [CLAUDE.md §11](../CLAUDE.md) under "Workflow Orchestrators".

---

## 7. Standard Patterns

### REST conventions (Golden Rule §5)

- Plural nouns (`/users`, `/orders`).
- kebab-case multi-word (`/order-items`).
- State-changing actions as POST sub-resources (`POST /users/:userId/activate`).
- Path params for identity, query params for filtering.

### Status badge mapping (Webapp / Mobile)

`status-variants.ts` files map domain enums (`USER_STATUSES`, `ORDER_STATUSES`, `PRODUCT_STATUSES`) to badge variants. Never hardcode status strings.

### Forms (Webapp)

`react-hook-form` + Zod resolver, schema imported from `@mma/contracts/{domain}`. See `webapp-form-with-validation` skill.

### Toast feedback

All mutations use `toast` from `@mma/ui`. `<Toaster>` is mounted once in `apps/webapp/src/app/layout.tsx`.

---

## 8. Effort Sizing Heuristics

Use these when filling the **Effort** field on issues:

| Effort | Definition | Examples |
|---|---|---|
| **XS** | ≤ 2h | Add a `data-testid`, fix a typo, bump a dependency, add a status to an existing enum + cascade. |
| **S** | ≤ 8h | Add a single endpoint to an existing service + tests; add a webapp filter; add a new ESLint rule. |
| **M** | ≤ 16h | New use case + repository method + endpoint + webapp UI; new shared UI primitive + adoption in 1–2 places. |
| **L** | ≤ 32h | Full-stack vertical slice (backend + webapp + mobile) for a new capability on an existing domain. |
| **XL** | > 32h | New domain (`/new-domain`); choreography saga across two domains; new microservice + Terraform wiring. |

---

## 9. Priority Heuristics

| Priority | When to use |
|---|---|
| **Critical (P0)** | Production down or blocked release. Drop everything. |
| **High (P1)** | Sprint-critical — must ship this sprint. |
| **Medium (P2)** | Planned for the sprint but not blocking. |
| **Low (P3)** | Backlog / nice-to-have / tech debt. |

---

## 10. Where to Find Things

| Looking for | Path |
|---|---|
| Architectural rules + Golden Rules | [CLAUDE.md](../CLAUDE.md) |
| Per-domain conventions | the nested `CLAUDE.md` in the relevant app/package (e.g. [apps/webapp/CLAUDE.md](../apps/webapp/CLAUDE.md)) |
| Workflow prompts | [.claude/commands/](../.claude/commands/) |
| Reusable skills | [.claude/skills/](../.claude/skills/) |
| Service / infra registry | [.github/service-registry.json](../.github/service-registry.json) |
| Per-service env vars | [.github/service-registry.env](../.github/service-registry.env) |
| Documentation | [docs/](./) |
| Local dev getting started | [docs/getting-started.md](getting-started.md) |
