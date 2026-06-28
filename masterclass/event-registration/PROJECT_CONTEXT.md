# Project Context — Event / Conference Registration

> **Masterclass project D** · Difficulty 🟡 Core · Persistence **DynamoDB OneTable** (cursor pagination).
> **🎨 Figma:** [Event Registration — project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2038-2) · [component library](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=10-2) (file: *Masterclass Project Designs*).
> The AI must read this file at the start of every session. Deeper rules live in [CLAUDE.md](../../CLAUDE.md).

---

## 1. What This Project Is

A **conference / event registration** platform. Organizers publish events with sessions and a seat
capacity; attendees register and either get confirmed or waitlisted when an event sells out. It is a
high-read, capacity-counter project — a clean **DynamoDB** teaching case with cursor pagination and
an **atomic-counter concurrency** edge (two attendees racing for the last seat).

The "spine": registering **synchronously validates the event is OPEN and within its registration
window (ACL)**; the registration then triggers a **seat-reservation saga** that atomically decrements
capacity and resolves the registration to `CONFIRMED` or `WAITLISTED` when sold out.

---

## 2. Bounded Contexts (Domains)

> Source of truth: [issue-config.json](issue-config.json) `domains[]`.

| Domain | Persistence | Service(s) | Role |
|---|---|---|---|
| `event` | DynamoDB OneTable | `event-api-service`, `event-event-handler-service` | Events, capacity, registration window (ACL target; reserves the seat in the saga). |
| `session` | DynamoDB OneTable | `session-api-service` | Sessions/talks within an event (per-session capacity). |
| `registration` | DynamoDB OneTable | `registration-api-service`, `registration-event-handler-service` | Attendee bookings (originates the ACL call + the saga). |
| `attendee` *(stretch → 4 domains)* | DynamoDB OneTable | `attendee-api-service` | Attendee profiles + history. |
| `ticket-type` *(stretch → 5 domains)* | DynamoDB OneTable | `ticket-type-api-service` | Paid/free tiers with their own caps. |

**Cross-cutting:** `webapp`, `mobile`, `infra`, `cross-domain`, `auth`.

---

## 3. User Roles

- `ADMIN` — organizer: create/publish events + sessions, set capacity, view registrations.
- `ATTENDEE` — register for events, view own registrations, cancel.

---

## 4. Tech Stack

NestJS 11 · Node 24 · **DynamoDB OneTable v2** · Zod contracts · SQS FIFO · Next.js 15 webapp ·
Expo mobile · `@old-st/telemetry`. (Full table: [docs/PROJECT_CONTEXT.md §4](../../docs/PROJECT_CONTEXT.md).)

---

## 5. Architectural Rules That Affect Every Issue

- Clean-Arch layering; application services always present.
- **DynamoDB → cursor pagination** (`items, nextCursorPointer, prevCursorPointer`). Never offset (#16).
- Every repository query passes an explicit **GSI index** param (see `dynamo-repository` skill).
- Seat decrement uses a **conditional/atomic update** to prevent overselling under concurrency.
- Contracts via `@old-st/contracts/{domain}` subpath only (#11); actor from `@CurrentUser()` (#23).
- **ACL:** `registration` validates `event` via an abstract port + HTTP adapter (#14).
- **Cross-domain events:** consumers import `@old-st/contracts/registration` — never the domain package (#15).

---

## 6. Workflow Prompts

| Scope | Prompt |
|---|---|
| New domain (DynamoDB) | `/new-domain-dynamo` |
| Feature / ACL | `/new-feature` (+ `sync-cross-service-call` skill) |
| Saga / SQS consumer | `/new-event-service` (+ `choreography-saga` skill) |
| Webapp page | `/webapp-feature` |
| Backend + webapp slice | `/full-stack-feature` |
| Mobile screen | `/mobile-feature` |

---

## 7. Standard Patterns

REST plural nouns (`/events`, `/registrations`); actions as POST sub-resources
(`POST /events/:id/publish`, `POST /registrations/:id/cancel`). Status badges via `status-variants.ts`.
Forms via react-hook-form + Zod from `@old-st/contracts/{domain}`.

---

## 8–9. Effort & Priority Heuristics

XS≤2h · S≤8h · M≤16h · L≤32h · XL>32h · P0–P3. (See [docs/PROJECT_CONTEXT.md §8–9](../../docs/PROJECT_CONTEXT.md).)

---

## 11. Domain Entities

### `event` (DynamoDB)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| name | string | |
| venue | string | |
| startsAt / endsAt | datetime | |
| capacity | integer | total seats |
| seatsReserved | integer | atomic counter |
| status | enum | `DRAFT, OPEN, SOLD_OUT, CLOSED` |
| registrationOpensAt / registrationClosesAt | datetime | window |

### `session` (DynamoDB)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| eventId | ulid | **GSI1**: list sessions by event |
| title | string | |
| speaker | string | |
| room | string | |
| startsAt | datetime | |
| capacity | integer | per-session |

### `registration` (DynamoDB)
| Field | Type | Notes |
|---|---|---|
| id | ulid | PK |
| eventId | ulid | **GSI1**: list registrations by event |
| attendeeId | ulid | **GSI2**: my registrations |
| status | enum | `REQUESTED, CONFIRMED, WAITLISTED, CANCELLED` |
| ticketType | string | optional (stretch) |
| registeredAt | datetime | |

---

## 12. Business Rules & Invariants

- **ACL gate:** `registration.request` calls `IEventValidator.validate(eventId)`. Rejects with
  `EventNotOpenError` / `RegistrationWindowClosedError` unless the event is `OPEN` and now is within
  `[registrationOpensAt, registrationClosesAt]`. No registration persists on failure.
- An attendee cannot have two non-cancelled registrations for the same event.
- **Seat counter:** `seatsReserved` is incremented with a conditional update (`seatsReserved < capacity`).
  When it reaches `capacity`, the event flips to `SOLD_OUT` and further requests are waitlisted.
- **Registration lifecycle:** `REQUESTED → CONFIRMED` (seat reserved) · `REQUESTED → WAITLISTED`
  (sold out) · `CONFIRMED/WAITLISTED → CANCELLED` (attendee; a cancel frees a seat and may promote
  the head of the waitlist).

### ACL seam (synchronous)
`registration.request` → `IEventValidator.validate(eventId)` →
`ValidatedEvent { eventId, status, windowOpen }`. Port in `registration-domain/application/interfaces/`;
HTTP adapter in `infrastructure/clients/` calling `event-api-service`. Forward auth + correlation via
`getOutboundHeaders()`.

### Choreography saga (asynchronous)
1. `registration.request` persists registration `REQUESTED` and publishes **`REGISTRATION_REQUESTED`**
   (`@old-st/contracts/registration`) with `{ eventId, attendeeId }`.
2. `event-event-handler-service` consumes it, runs `ReserveSeatUseCase` (atomic conditional increment),
   replies **`SEAT_RESERVED`** or **`SOLD_OUT`** (`@old-st/contracts/event`).
3. `registration-event-handler-service` consumes the reply → registration `CONFIRMED` | `WAITLISTED`.
   A `CANCEL` frees a seat (`SEAT_RELEASED`) and may promote a waitlisted registration. **Idempotent**:
   re-delivering `SEAT_RESERVED` must not reserve a second seat.

---

## 10. Where to Find Things

Golden Rules → [CLAUDE.md](../../CLAUDE.md) · Workflows → [.claude/commands/](../../.claude/commands/) ·
Skills (`dynamo-repository`, `new-dynamo-schema`) → [.claude/skills/](../../.claude/skills/) ·
Handbook → [docs/engineering-handbook.md](../../docs/engineering-handbook.md).
