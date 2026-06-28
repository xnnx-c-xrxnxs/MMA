# Project Guide — Full-Stack Clean Architecture (Nx Monorepo)

Backend (NestJS microservices + Clean-Architecture domain packages), frontend (Next.js
webapp + Expo mobile + shared UI / data-access packages), and deployment (Terraform modules

- CD workflows). This file is the **always-on contract**: the Golden Rules, agent operating
  rules, and pointers. Deep reference detail lives in
  **[docs/engineering-handbook.md](docs/engineering-handbook.md)** — read it for directory
  layout, step-by-step checklists, persistence/API/exception/env/CD sections, and the full
  skill + workflow catalogs.

> `examples/`, when present, is a frozen reference of the previous full implementation
> (users + products + orders + categories), excluded from CI/CD via `paths-ignore`. Most new
> projects delete it via `scripts/init-project.mjs`. Skills do **not** depend on `examples/`.

## How this repo is wired for Claude Code

| What                                              | Where                                                                                                      | How to use                                                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Skills** (self-contained how-to guides)         | `.claude/skills/<name>/SKILL.md`                                                                           | Auto-discovered by `description`; invoke `/<name>` or let the model pick. Start with `nx-workspace` / `nx-generate` for any Nx task. |
| **Commands** (multi-step orchestrators)           | `.claude/commands/<name>.md`                                                                               | Run `/<name>` (e.g. `/new-domain`, `/full-stack-feature`, `/migrate-extract`).                                                       |
| **Subagents** (isolated audits + scoped builders) | `.claude/agents/<name>.md`                                                                                 | Spawned via the **Agent tool** with `subagent_type="<name>"`; each has an enforced `tools:` allow-list.                              |
| **Path-scoped rules**                             | nested `CLAUDE.md` in `apps/*` & `packages/*`                                                              | Auto-loaded when you work inside that subtree.                                                                                       |
| **Architecture decisions (ADRs)**                 | `docs/decisions/NNN-*.md`                                                                                  | Read the relevant ADR before changing an area it governs (see policy below).                                                         |
| **Full reference**                                | [docs/engineering-handbook.md](docs/engineering-handbook.md)                                               | Directory map, checklists, persistence/API/CD detail, skill→task + workflow tables.                                                  |
| **Agent architecture**                            | [docs/AGENT_ARCHITECTURE.md](docs/AGENT_ARCHITECTURE.md), [docs/agents-catalog.md](docs/agents-catalog.md) | Three-tier model + subagent catalog.                                                                                                 |

**Orchestration model:** commands dispatch subagents via the Agent tool
(`subagent_type="X"` → `.claude/agents/X.md`). Read-only audit agents run in parallel;
scoped-write builders are restricted by their `tools:` allow-list + in-prose scope rules. A
subagent returns a single Markdown report — never raw tool transcripts. Subagents never spawn
other subagents; the main thread owns dispatch. (ADR-008 / ADR-007.)

## Where things live (condensed — full tree in the handbook)

- **`apps/{domain}/{domain}-api-service`** — HTTP API (NestJS). **`{domain}-event-handler-service`** — SQS consumer (no HTTP).
- **`apps/auth/auth-api-service`**, **`apps/files/file-api-service`**, **`apps/monitoring/{monitoring-api-service,monitoring-webapp}`** — platform services.
- **`apps/webapp`** — Next.js App Router (static export). **`apps/mobile`** — Expo / React Native.
- **`packages/{domain}-domain`** — Clean-Arch core (domain / application / infrastructure). **`packages/contracts/{domain}`** — per-domain Zod schemas + types (subpath imports).
- **`packages/ui`** (web primitives), **`packages/mobile-ui`**, **`packages/client-common`** (API clients + React Query hooks, shared web+mobile), **`packages/design-tokens`**.
- **`packages/aws/{aws-secrets,aws-cognito,aws-sqs,aws-s3}`**, **`packages/telemetry`** (`createLogger`, correlation), **`packages/common`**, **`packages/dynamodb-onetable`**, **`packages/nx-plugin`**.
- **`infra/`** — `bootstrap/`, `init-runner/`, `modules/`, `environments/`. **`.github/`** — `workflows/`, `service-registry.{json,env}`. **`docs/`** — engineering handbook, ADRs (`decisions/`), onboarding guides.

---

## Golden Rules (Always Enforced)

1. **Controllers never call use-cases directly.**
2. **Application Services are always present** (even for simple operations).
3. **Use Cases return domain entities.**
4. **Application Services transform entities to DTOs (contracts).**
5. **Domain layer has zero dependencies on contracts or NestJS.**
6. **Infrastructure implements repository interfaces** and does not add business logic.
7. **Zod validation lives in presentation** (pipes, DTO parsing) and contracts.
8. **Domain constants are single source of truth** (USER_ROLES, USER_STATUSES). Always use `UserStatusEnum`/`UserRoleEnum` (or the domain-equivalent enum object) for all status/role comparisons and assignments inside entity methods. **Never hardcode string literals** like `'PENDING'`, `'ACTIVE'`, `'USER'`, etc.
9. **Typed domain exceptions map to HTTP errors** via `DomainExceptionFilter`.
10. **Never trust userId from client input.**
    10a. **All mutation application service methods must accept `actorId: string` and include it in every `logger.info()` call.** Controllers extract the actor from the JWT via `@CurrentUser('userId') actorId: string` and pass it through. This is how you answer "who did X?" in CloudWatch. Read-only methods (GET/list) do not require `actorId`. Example log fields: `{ userId, actorId }` for admin operations, `{ actorId }` for self-service mutations.
11. **Never import from the bare `@old-st/contracts` root.** Always use domain-scoped imports (`@old-st/contracts/{domain}` and `@old-st/contracts/common`). Each domain subpath is backed by an independent per-domain package under `packages/contracts/{domain}/`. This prevents transitive type coupling between domains — a type error in any domain cannot break consumers of other domains.
12. **Entity timestamps are `dateCreated` + `updatedAt` only.** Never add a `createdAt` field to domain entities. OneTable auto-manages a persistence-level `createdAt` via `timestamps: true` — repositories read `record.createdAt` and map it to the domain's `dateCreated`. The domain layer never sees `createdAt`.
13. **Never add `toObject()` to domain entities.** Serialization is handled by the Application Service → Zod `schema.parse()` pipeline. Entities expose getters, not serialization methods.
14. **Synchronous cross-service calls must use an Anti-Corruption Layer (ACL).** The consuming domain defines an abstract validator interface in `application/interfaces/`. The service's `infrastructure/clients/` provides the HTTP adapter. The use case never sees HTTP, Axios, or upstream domain types. See the `sync-cross-service-call` skill.
15. **Cross-domain event consumers import from the publishing domain's contracts only — never from its domain package.** A service consuming events from another bounded context imports event schemas and type enums from `@old-st/contracts/{publishing-domain}`. It must never import from `@old-st/{publishing-domain}-domain`. See the `cross-domain-event-handler` skill.
16. **Prisma domains use `IOffsetPaginatedResponse`; DynamoDB domains use `IPaginatedResponse`.** Never mix pagination styles within a single domain. If a domain uses Prisma, all its list endpoints return offset-based results (`data`, `total`, `page`, `limit`, `totalPages`). If a domain uses DynamoDB, all its list endpoints return cursor-based results (`items`, `nextCursorPointer`, `prevCursorPointer`).
17. **Prisma schema enums must mirror domain constants exactly.** Never define enum values in the Prisma schema that don't exist in domain constants. The domain constants are the single source of truth — the Prisma schema copies them.
18. **The generated Prisma client is infrastructure-only.** Domain and application layers must never import from `@prisma/client` or from the generated client path. Only repository implementations in `infrastructure/repositories/` may use the Prisma client.

### Telemetry & File Rules

19. **All services must use `createLogger()` from `@old-st/telemetry` for logging — never `new Logger()` from `@nestjs/common`.** Declare a module-level singleton: `const logger = createLogger('service-name')`. Logs emit as structured JSON with `traceId`/`spanId`/`correlationId`. Call `initTelemetry('service-name')` in `main.ts` **before** `NestFactory.create()` (no-op locally when `OTEL_SDK_DISABLED=true`). (Enforced by `app-service-has-logger`.)
20. **All HTTP API services must use `correlationMiddleware()` from `@old-st/telemetry`** as the **first** middleware in `setupGlobalMiddleware()`. Generates/reuses a `correlationId` per request via `AsyncLocalStorage`. Event schemas include `correlationId: z.string().optional()`; SQS publishers auto-inject it; handlers wrap processing in `runWithCorrelationId()`; ACL adapters spread `...getCorrelationHeaders()` (or `getOutboundHeaders()`) into outbound headers. End-to-end tracing without X-Ray.
21. **All file uploads and downloads MUST go through `file-api-service`.** Domain services never touch S3 directly. The file service issues presigned URLs (`POST /api/files/presigned-upload`, `GET /api/files/presigned-download/:key`); the client uploads/downloads directly to S3 — no bytes through the backend. Store only the `fileKey` in the domain entity. See the `file-upload-s3` skill.

### E2E Testing Rules

22. **All E2E-testable webapp components must have `data-testid` attributes** following the pattern `{domain}s-table`, `{domain}-row-{id}`, `status-filter`, `create-{domain}-btn`, `{domain}-status-badge`, `create-{domain}-form`. See `apps/webapp-e2e/src/utils/selectors.ts`.

### Authenticated Actor Rules

23. **Always read the authenticated actor from the JWT via `@CurrentUser()` — never from `@Body()`, `@Query()`, or `@Param()`.** Each service ships `presentation/decorators/current-user.decorator.ts` exposing `AuthenticatedUser = { userId, email, userRole? }` from `request.user`. Path params like `:userId` identify the _subject_ of an admin action; the _actor_ always comes from the JWT. Enforced by `no-userId-in-controller-input`. See the `current-user-decorator` skill.
24. **ACL adapters must forward the originating `Authorization` header via `getOutboundHeaders()` from `@old-st/telemetry`.** This sends BOTH `x-correlation-id` AND `Authorization: Bearer ...` so the downstream `@CurrentUser()` resolves to the same actor end-to-end. Use `getOutboundHeaders()` (full) instead of the legacy `getCorrelationHeaders()` (correlationId-only) for any cross-service call to an authenticated endpoint.
25. **Every `@Body()`/`@Query()`/`@Param()` MUST have a matching `@ApiBody()`/`@ApiQuery()`/`@ApiParam()` with an explicit `schema` block, and every `@Controller` MUST have `@ApiTags()`** (plus `@ApiOperation({ summary })` per handler). Without these, Swagger "Try it out" shows no fields because Zod-inferred types are erased at runtime. Enforced by `swagger-decorators-required`. See the `swagger-controller-docs` skill.

---

## Code Style

- Keep controllers thin; application services orchestration-only; domain entities pure (no DTOs, no frameworks); infrastructure the only place with database code.
- Prefer explicit names (`listUsersByStatus`, `verifyUserEmail`).
- **Never use non-null assertions (`!`)** — ESLint enforces `@typescript-eslint/no-non-null-assertion`. Use a guard: assign, check for `undefined`/`null`, throw or return early.
- **Always run tasks through Nx** (`npx nx build/test <project>`; prefer `--skip-nx-cache` for verification). Node.js 24 (Active LTS); Lambda runtime `nodejs24.x`; TS target `es2022`. See `@AGENTS.md` and the `nx-workspace` skill.

---

## Agent Operating Rules (Do Not Violate)

1. **Read the skill before coding.** Before writing any code, check whether the task matches one or more skills. If so, `Read` the full `SKILL.md` and follow it exactly — its instructions override inferred patterns. Multiple skills may apply (e.g. `domain-business-rules` + `add-contracts` + `dynamo-repository`); read all of them. Do not skip this even when the pattern seems obvious. The full **skill → task** and **workflow** mapping tables are in [docs/engineering-handbook.md](docs/engineering-handbook.md) § 11.
2. **Respect Clean Architecture boundaries** and the Golden Rules above; use `@old-st/contracts/{domain}` subpath imports for DTOs/schemas.
3. **Use Context7 for library docs.** When generating code that uses a third-party library (NestJS, Next.js, Prisma, Expo, Terraform, AWS SDK, TanStack Query, Zod, etc.), fetch up-to-date docs via the `context7` MCP tool (`resolve-library-id` → `query-docs`) rather than relying on training data.
4. **Ask before coding when ambiguous** — domain/entity/service names, persistence (table/index/attributes), API routes & verbs, required DTOs, pagination/filters, business rules/invariants, or sync-vs-async communication.

### Orchestrator (command) design rules

1. **Interview before code** — collect all required info before loading any skill or writing files.
2. **Phase validation** — after each phase, build/test affected files via `Bash`; fix errors before proceeding.
3. **Lazy skill loading** — read a skill's `SKILL.md` only when its phase is about to execute.
4. **Exitable mid-workflow** — each phase produces valid, compilable code.
5. **Final verification** — end with `nx test` + `nx build` for all affected projects.
6. **Compose, don't replace** — orchestrators compose skills; skills remain authoritative for single-layer patterns.

---

## Coverage Thresholds (full testing guidance in the handbook § 12–13)

| Project type                          | Threshold         | Examples                                      |
| ------------------------------------- | ----------------- | --------------------------------------------- |
| Domain packages (`packages/*-domain`) | 80% (all metrics) | `user-domain`, `order-domain`                 |
| Service apps (`apps/*/`)              | 70%               | `user-api-service`, `*-event-handler-service` |
| Frontend apps                         | 70%               | `webapp`, `mobile`                            |
| Shared packages                       | 70%               | `client-common`, `ui`                         |
| E2E projects                          | none              | `*-e2e`                                       |

Domain entities, use cases, application services, and event handlers are **always** tested. Co-locate `.spec.ts(x)` next to source.

---

## Architectural Decisions (ADRs) — Global Policy

All architectural decisions are recorded in `docs/decisions/`. When a task touches an area covered by an ADR, **read it before writing code**. Do not contradict an ACCEPTED decision without recording a superseding ADR that marks the original SUPERSEDED.

**Propose a new ADR** when work involves: choosing between architectural approaches; a pattern that constrains all future code in an area; rejecting an attractive alternative; superseding an ACCEPTED decision; or a hard-to-reverse cross-cutting dependency/library/infra component. **Do not record** routine implementation choices.

**Always ask first** — never auto-create an ADR. Summarise the decision in one sentence, ask "Should I record this as an architectural decision in `docs/decisions/`?", and only create it (using the template in the existing ADRs) if the user agrees.

---

## Nx Guidelines

@AGENTS.md
