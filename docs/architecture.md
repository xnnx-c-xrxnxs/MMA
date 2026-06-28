# Architecture & Coding Standards

This page is the canonical guide for **how this codebase is structured and what rules govern it**. The interactive HTML version with diagrams lives at [html/architecture.html](html/architecture.html).

> **Authoritative source:** the AI-facing rules are in [`CLAUDE.md`](../CLAUDE.md). This page is the human-readable summary.

---

## Clean Architecture Layers

```
Presentation (NestJS controllers, pipes, filters)
  -> Application Services (orchestration + DTO mapping)
    -> Use Cases (single-purpose domain operations)
      -> Domain Entities (business rules + invariants)
        -> Infrastructure (DynamoDB OneTable or Prisma + PostgreSQL repositories)
```

**Dependency rule:** inner layers never depend on outer layers. Infrastructure depends inward only via repository interfaces declared in the domain.

### Layer Responsibilities

| Layer | What it does | What it MUST NOT do |
|---|---|---|
| **Presentation** | Parse HTTP, validate with Zod, map errors to status codes | Contain business logic, talk to the database directly |
| **Application Service** | Orchestrate use cases, transform entities → DTOs via Zod | Contain business rules, skip use cases |
| **Use Case** | Single domain operation (e.g. `CreateUserUseCase`) | Return DTOs, depend on `@old-st/contracts/*` |
| **Domain Entity** | Business invariants, state transitions, factory methods | Import NestJS, Zod, infrastructure, contracts |
| **Repository (interface)** | Type contract for persistence | Contain SQL or Dynamo code |
| **Repository (implementation)** | Translate domain entities ↔ persistence rows | Contain business decisions |

---

## Frontend Architecture

```
Page (apps/webapp/src/app/{domain}/page.tsx)
  -> Domain Components (apps/webapp/src/components/{domain}/)
    -> React Query Hooks (packages/client-common/src/hooks/)
      -> API Clients (packages/client-common/src/infrastructure/api-clients/)
        -> Backend REST APIs
```

**Pages are thin orchestrators.** Domain UI (tables, forms, action menus) lives in `components/{domain}/`. The `client-common` package is shared between webapp and mobile — hooks and API clients are written once.

## Mobile Architecture

```
Screen (apps/mobile/src/app/{domain}/)
  -> Domain Components (apps/mobile/src/components/{domain}/)
    -> React Query Hooks (packages/client-common/src/hooks/)        ← SHARED with webapp
      -> API Clients (packages/client-common/src/infrastructure/)   ← SHARED with webapp
```

---

## Bounded Contexts

The repository contains **5 backend bounded contexts** plus an internal monitoring tool:

| Context | Persistence | Purpose |
|---|---|---|
| `user-domain` | DynamoDB OneTable | User accounts, roles, status lifecycle |
| `product-domain` | DynamoDB OneTable | Product catalog, inventory, status |
| `order-domain` | Prisma + PostgreSQL | Order aggregates, items, choreography saga |
| `auth-api-service` | Cognito / LocalAuthProvider | Sign-in, refresh, password flows |
| `file-api-service` | S3 (presigned URLs) | File upload/download |
| `monitoring-*` (internal tool) | CloudWatch / X-Ray / OTel | Internal observability dashboard |

Read the interactive [html/domains.html](html/domains.html) for the full DDD breakdown.

---

## Golden Rules (Always Enforced)

The complete enforced rules list is in [`CLAUDE.md`](../CLAUDE.md) §2 (37 rules covering backend, frontend, mobile, auth, telemetry, CD). Highlights:

1. Controllers never call use cases directly — always through an Application Service.
2. Use cases return domain entities; Application Services transform to DTOs via Zod.
3. Domain layer has zero framework dependencies (no NestJS, no Zod, no contracts).
4. Repository interfaces live in the domain package; implementations in infrastructure.
5. Never trust `userId` from client input.
6. **Never import from bare `@old-st/contracts`** — always domain-scoped (`@old-st/contracts/{domain}`).
7. Entities use `dateCreated` + `updatedAt`. Never add `createdAt`.
8. Entities have **no `toObject()`** method. Serialization happens in the Application Service via Zod `schema.parse()`.
9. All status/role comparisons use **enum constants** from the domain. Never hardcode `'PENDING'`, `'ACTIVE'`, etc.
10. Use `STAGE === 'local'` for local-vs-AWS branching. **Never** use `NODE_ENV === 'development'`.
11. Every API service uses **`createLogger()`** from `@old-st/telemetry` (not `new Logger()` from `@nestjs/common`).
12. Every HTTP API service uses **`correlationMiddleware()`** from `@old-st/telemetry` for end-to-end request tracing.
13. **All file uploads/downloads MUST go through `file-api-service`** — domain services never touch S3 directly.

---

## Persistence Patterns

Two persistence strategies coexist. The domain layer is unaware of which one is in use.

| | DynamoDB OneTable | Prisma + PostgreSQL |
|---|---|---|
| **Used by** | `user-domain`, `product-domain` | `order-domain` |
| **Pagination** | Cursor (`IPaginatedResponse`) | Offset (`IOffsetPaginatedResponse`) |
| **Local** | LocalStack | Docker Postgres |
| **Schema location** | `infrastructure/schemas/` | `infrastructure/prisma/schema.prisma` |

See [html/persistence.html](html/persistence.html) for the full deep dive.

---

## Inter-Service Communication

Three patterns are demonstrated:

| Pattern | When to use | Skill |
|---|---|---|
| **Synchronous ACL** | Real-time validation (e.g. order checks user exists) | `sync-cross-service-call` |
| **Cross-domain async events** | One domain reacts to another's lifecycle events | `cross-domain-event-handler` |
| **Choreography saga** | Multi-step workflow with eventual state resolution | `choreography-saga` |

See [html/domain-interactions.html](html/domain-interactions.html) for the full saga walkthrough.

---

## Coding Standards Enforcement

Standards are enforced by multiple layers:

| Mechanism | What it covers | Blocks PR? |
|---|---|---|
| **ESLint plugin** (`@old-st/eslint-plugin`) | Domain framework imports, hardcoded statuses, bare contracts, Prisma client placement, fetch in components | Yes |
| **Nx module boundaries** | Cross-domain leaks, package-level dependency rules | Yes |
| **CI structural checks** (`scripts/lint-standards.ts`) | Toolchain-level rules (no-toObject, no-createdAt, controller-no-direct-usecase, registry-env-sync, app-service-has-logger, etc.) | Yes |
| **Spectral API lint** (`.spectral.yml`) | REST conventions, error response shape | Yes |
| **Coverage thresholds** (per `jest.config`) | 80% for domain, 70% for services/frontend | Yes |
| **Code Review** (`docs/code-review-guidelines.md`) | Judgment calls (DTO mapping, AAA pattern, naming) | Advisory |

### Adding a New Standard

If lint-able → add an ESLint rule in `packages/eslint-plugin/src/rules/`. If structural → add a check in `scripts/lint-standards.ts` (use the **`add-structural-lint-check` skill**). If judgment-based → add to `docs/code-review-guidelines.md`.

---

## Architecture Documentation Map

| Topic | Where |
|---|---|
| Layer hierarchy & golden rules | [html/architecture.html](html/architecture.html) |
| Bounded contexts (User, Product, Order, Auth, Files) | [html/domains.html](html/domains.html) |
| Domain interactions (sync ACL, events, sagas) | [html/domain-interactions.html](html/domain-interactions.html) |
| Persistence patterns (DynamoDB vs Prisma) | [html/persistence.html](html/persistence.html) |
| Contracts & Zod schemas | [html/contracts.html](html/contracts.html) |
| Event-driven (SQS) | [html/event-driven.html](html/event-driven.html) |
| Webapp (Next.js) | [html/webapp.html](html/webapp.html) |
| Mobile (Expo) | [html/mobile.html](html/mobile.html) |
| Authentication | [html/auth.html](html/auth.html) |
| Local infrastructure | [html/infrastructure.html](html/infrastructure.html) |
| Monitoring & observability | [monitoring.md](monitoring.md) + [html/monitoring.html](html/monitoring.html) |
