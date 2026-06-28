# Project Context — Asset / Equipment Loan

> **Masterclass project E** · Difficulty 🟢 Starter · Persistence **Prisma + PostgreSQL** (offset pagination).
> **🎨 Figma:** [Asset Loan — project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2028-2) · [component library](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=10-2) (file: *Masterclass Project Designs*).
> The AI must read this file at the start of every session. Deeper rules live in [CLAUDE.md](../../CLAUDE.md).

---

## 1. What This Project Is

An internal **IT asset checkout** system. Staff borrow shared equipment (laptops, monitors, AV kit,
test devices); IT admins manage the catalogue and approve returns. It is the smallest masterclass
project — 3 core domains — and the gentlest on-ramp to the repo's ACL + saga patterns.

The "spine" you build toward: a borrower requests a loan → the system **synchronously checks the
asset is available (ACL)** → it persists the loan as `REQUESTED` and **asynchronously reserves the
asset (saga)** → the asset replies reserved/unavailable → the loan resolves to `ACTIVE` or
`REJECTED`. Returning a loan releases the asset.

---

## 2. Bounded Contexts (Domains)

> Source of truth: [issue-config.json](issue-config.json) `domains[]`.

| Domain | Persistence | Service(s) | Role |
|---|---|---|---|
| `asset` | Prisma + PostgreSQL | `asset-api-service`, `asset-event-handler-service` | Equipment catalogue + availability (the upstream the ACL validates against; reserves/releases in the saga). |
| `loan` | Prisma + PostgreSQL | `loan-api-service`, `loan-event-handler-service` | Checkout lifecycle (originates the ACL call + the saga). |
| `borrower` | Prisma + PostgreSQL | `borrower-api-service` | Staff who borrow; loan-count limits. |
| `maintenance` *(stretch → 4 domains)* | Prisma + PostgreSQL | `maintenance-api-service` | Service/repair records that take an asset out of circulation. |

**Cross-cutting:** `webapp`, `mobile`, `infra`, `cross-domain`, `auth`.

---

## 3. User Roles

- `ADMIN` — IT staff: manage assets, approve returns, force-release, view all loans.
- `BORROWER` — standard staff: browse available assets, request a loan, return their own loans.

Role enum lives in the auth domain — never hardcode role strings (Golden Rule #8).

---

## 4. Tech Stack

NestJS 11 · Node 24 · **Prisma 5 + PostgreSQL 16** · Zod contracts · SQS FIFO (`@old-st/aws-sqs`) ·
Next.js 15 webapp · Expo mobile (optional) · `@old-st/telemetry` logging + correlation. (Full table:
[docs/PROJECT_CONTEXT.md §4](../../docs/PROJECT_CONTEXT.md).)

---

## 5. Architectural Rules That Affect Every Issue

- Clean-Arch layering; application services always present; controllers never call use cases directly.
- **Prisma → offset pagination** (`data, total, page, limit, totalPages`). Never cursor (Golden Rule #16).
- Contracts via `@old-st/contracts/{domain}` subpath only (#11).
- Authenticated actor from `@CurrentUser()` only (#10, #23).
- **ACL:** `loan` validates `asset` via an abstract port + HTTP adapter (#14).
- **Cross-domain events:** consumers import `@old-st/contracts/asset` — never `@old-st/asset-domain` (#15).

---

## 6. Workflow Prompts

| Scope | Prompt |
|---|---|
| New domain (Prisma) | `/new-domain` |
| Feature / ACL on existing domain | `/new-feature` (+ `sync-cross-service-call` skill) |
| Saga / SQS consumer | `/new-event-service` (+ `choreography-saga` skill) |
| Webapp page | `/webapp-feature` |
| Backend + webapp slice | `/full-stack-feature` |
| Mobile screen | `/mobile-feature` |

---

## 7. Standard Patterns

REST: plural nouns (`/assets`, `/loans`), state actions as POST sub-resources
(`POST /loans/:loanId/return`). Status badges via `status-variants.ts`. Forms via react-hook-form +
Zod resolver from `@old-st/contracts/{domain}`. Toasts via `@old-st/ui`.

---

## 8–9. Effort & Priority Heuristics

Effort XS≤2h · S≤8h · M≤16h · L≤32h · XL>32h. Priority P0 blocker · P1 sprint-critical · P2 planned ·
P3 backlog. (Same definitions as [docs/PROJECT_CONTEXT.md §8–9](../../docs/PROJECT_CONTEXT.md).)

---

## 11. Domain Entities

### `asset` (Prisma)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| assetTag | string | unique (e.g. `LAP-0042`) |
| name | string | |
| category | enum | `LAPTOP, MONITOR, PHONE, AV, ACCESSORY` |
| status | enum | `AVAILABLE, RESERVED, ON_LOAN, MAINTENANCE, RETIRED` |
| condition | enum | `NEW, GOOD, FAIR, DAMAGED` |
| dateCreated / updatedAt | datetime | |

### `loan` (Prisma)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| assetId | ulid | FK → asset |
| borrowerId | ulid | FK → borrower |
| status | enum | `REQUESTED, ACTIVE, RETURNED, OVERDUE, REJECTED` |
| checkoutAt | datetime | set when ACTIVE |
| dueAt | datetime | |
| returnedAt | datetime | optional |

### `borrower` (Prisma)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| name | string | |
| email | string | unique |
| department | string | |
| activeLoanCount | integer | derived/guarded |
| maxLoans | integer | default 3 |

---

## 12. Business Rules & Invariants

- **ACL gate:** `loan.checkout` calls `IAssetValidator.validate(assetId)`. Rejects with
  `AssetUnavailableError` unless the asset is `AVAILABLE`. No loan persists on failure.
- A borrower cannot exceed `maxLoans` active loans (guard in the `borrower`/`loan` use case).
- **Loan lifecycle:** `REQUESTED → ACTIVE` (saga success) · `REQUESTED → REJECTED` (saga failure) ·
  `ACTIVE → RETURNED` (return action) · `ACTIVE → OVERDUE` (past `dueAt`).
- **Asset lifecycle:** `AVAILABLE → RESERVED` (saga reserve) → `ON_LOAN` (loan ACTIVE) →
  `AVAILABLE` (on return). `MAINTENANCE`/`RETIRED` assets are never loanable.

### ACL seam (synchronous)
`loan.checkout` → `IAssetValidator.validate(assetId)` → `ValidatedAsset { assetId, status }`.
Port in `packages/loan-domain/src/application/interfaces/`; HTTP adapter in
`infrastructure/clients/` calling `asset-api-service`. Forward auth + correlation via `getOutboundHeaders()`.

### Choreography saga (asynchronous)
1. `loan.checkout` persists loan `REQUESTED` and publishes **`LOAN_REQUESTED`** (`@old-st/contracts/loan`).
2. `asset-event-handler-service` consumes it, runs `ReserveAssetUseCase`, replies with
   **`ASSET_RESERVED`** or **`ASSET_UNAVAILABLE`** (`@old-st/contracts/asset`).
3. `loan-event-handler-service` consumes the reply → loan `ACTIVE` (set `checkoutAt`) or `REJECTED`.
4. On `POST /loans/:id/return` → publish **`LOAN_RETURNED`** → asset handler flips asset back to
   `AVAILABLE`. **Idempotent:** replaying a reply after the loan left `REQUESTED` is a no-op.

---

## 10. Where to Find Things

Golden Rules → [CLAUDE.md](../../CLAUDE.md) · Workflows → [.claude/commands/](../../.claude/commands/) ·
Skills → [.claude/skills/](../../.claude/skills/) · Handbook → [docs/engineering-handbook.md](../../docs/engineering-handbook.md).
