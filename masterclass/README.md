# Masterclass Projects

> Training material for the `old-st-template` masterclass. Five self-contained project briefs that
> a small team (one **Frontend** dev + one **Backend** dev) can pick from to practice this repo's
> **architecture**, **structure**, and **AI-native components** (skills, commands, subagents).
>
> These docs are **isolated from the real product docs** under `docs/`. Nothing here is wired into
> CI/CD — it is a learning sandbox.

---

## How the masterclass works

1. **Pick a project** from the table below (one per pair).
2. **Read its `PROJECT_CONTEXT.md`** — it is the same shape as the repo's real
   [docs/PROJECT_CONTEXT.md](../docs/PROJECT_CONTEXT.md): domains, roles, entities, business rules,
   the **ACL seam**, and the **event saga**. This is the "spine" you build toward.
3. **Copy the project's `issue-config.json`** into `.github/issue-config.json` (or point your AI
   session at it) so domain labels and `/import-estimate-csv` inference work.
4. **Feed the `user-stories.csv`** into the issue pipeline:
   `/import-estimate-csv` → review → `docs/AI_ISSUE_CREATOR_PROMPT.md` batch mode to create issues.
5. **Build vertical slices** with the workflow prompts named in each story's `Workflow` column:
   `/new-domain` → `/new-feature` (ACL) → `/new-event-service` (saga) → `/webapp-feature` →
   `/full-stack-feature` → `/mobile-feature`.
6. **Grade against the Golden Rules** (see [FACILITATOR_GUIDE.md](FACILITATOR_GUIDE.md)).

Every project deliberately contains **exactly one ACL seam** (synchronous cross-service
validation) and **exactly one choreography saga** (async request→reply across bounded contexts),
because those are the two patterns the frozen `examples/` reference exists to teach.

---

## Project picker

| # | Project | Folder | Persistence | Domains (core + stretch) | Difficulty | ACL seam (sync) | Saga (async) |
|---|---|---|---|---|---|---|---|
| **E** | Asset / Equipment Loan | [asset-loan/](asset-loan/) | **Prisma** (offset) | `asset`, `loan`, `borrower` (+`maintenance`) | 🟢 Starter | `loan.checkout` → asset `AVAILABLE` | `LOAN_REQUESTED` → reserve → `ASSET_RESERVED \| ASSET_UNAVAILABLE` |
| **B** | Clockify (time tracking) | [clockify/](clockify/) | **DynamoDB** (cursor) | `workspace`, `project`, `timeentry` (+`task`,`invoice`) | 🟡 Core | `timeentry.start` → project `ACTIVE` + member | `TIMESHEET_SUBMITTED` → budget check → `BUDGET_OK \| BUDGET_EXCEEDED` |
| **A** | HR Leave Management | [hr-leave/](hr-leave/) | **Prisma** (offset) | `employee`, `leave`, `holiday` (+`department`,`notification`) | 🟡 Core | `leave.submitRequest` → employee `ACTIVE` + balance | `LEAVE_REQUEST_SUBMITTED` → reserve balance → `BALANCE_RESERVED \| BALANCE_INSUFFICIENT` |
| **D** | Event / Conference Registration | [event-registration/](event-registration/) | **DynamoDB** (cursor) | `event`, `session`, `registration` (+`attendee`,`ticket-type`) | 🟡 Core | `registration.request` → event `OPEN` + window | `REGISTRATION_REQUESTED` → reserve seat → `SEAT_RESERVED \| SOLD_OUT` |
| **C** | Helpdesk / Ticketing | [helpdesk/](helpdesk/) | **Prisma** (offset) | `ticket`, `agent`, `customer` (+`team`,`knowledge-base`) | 🔴 Stretch | `ticket.assign` → agent `AVAILABLE` + capacity | `TICKET_CREATED` → auto-route → `TICKET_ASSIGNED \| NO_AGENT_AVAILABLE` |

**Persistence balance:** 3 Prisma (offset pagination) + 2 DynamoDB (cursor pagination). One persistence per project — **never mixed** (Golden Rule #16).

---

## Figma designs

All screens live in one Figma file — **[Masterclass Project Designs](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs)** — one page per project, built from a shared component library (extended from the *Old St Labs Time Tracker* design system). Each page holds the project's screens, states and modals; they're valid inputs for `/figma-page` / `/figma-import`.

| Page | Link |
|---|---|
| 🧩 Component library | [Components](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=10-2) |
| 🔐 Shell & Auth patterns | [Patterns · Shell & Auth](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2021-2) |
| **E** · Asset Loan | [project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2028-2) |
| **B** · Clockify | [project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2030-2) |
| **A** · HR Leave | [project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2033-2) |
| **C** · Helpdesk | [project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2036-2) |
| **D** · Event Registration | [project page](https://www.figma.com/design/d0XyGrGFys4ZEnbWYNDNYO/Masterclass-Project-Designs?node-id=2038-2) |

> The file is in *Dennis Mariano's team* drafts. To run `/figma-page`, enable the file's component library and paste a frame URL.

---

## Teaching-goal matrix

Which repo capability each project exercises, so you can assign by learning objective:

| Capability | A · HR Leave | B · Clockify | C · Helpdesk | D · Event Reg | E · Asset Loan |
|---|:--:|:--:|:--:|:--:|:--:|
| Clean-Arch layering (domain → app → infra) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ACL — sync cross-service validation** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Choreography saga (SQS request→reply)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| Event-handler service (no HTTP) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Prisma + offset pagination | ✅ | — | ✅ | — | ✅ |
| DynamoDB OneTable + cursor pagination + GSIs | — | ✅ | — | ✅ | — |
| Idempotent event handler | ✅ | ✅ | ✅ | ✅ | ✅ |
| Atomic counter / concurrency edge | — | ✅ | — | ✅ | ✅ |
| Contracts subpath imports (`@old-st/contracts/{domain}`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@CurrentUser()` actor from JWT | ✅ | ✅ | ✅ | ✅ | ✅ |
| Webapp thin-orchestrator page + data-table | ✅ | ✅ | ✅ | ✅ | ✅ |
| Webapp form (react-hook-form + Zod) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Status-variant badge mapping | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mobile screen (Expo) | ✅ | ✅ | optional | ✅ | optional |
| State-machine / lifecycle transitions | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## What's in each project folder

| File | Purpose |
|---|---|
| `PROJECT_CONTEXT.md` | The AI snapshot — domains, roles, entities (§11), business rules (§12), ACL seam, saga. Read first. |
| `issue-config.json` | Domain + cross-cutting labels; drives `/import-estimate-csv` inference. |
| `user-stories.csv` | Canonical 10-column issue CSV (`Epic,User_Story,Domain,Story_Type,Priority,Effort,Sprint,Workflow,Touches,Notes`), sequenced domain → ACL → saga → UI. |

---

## Workflow prompts you'll use (all real `.claude/commands/`)

| Scope | Prompt |
|---|---|
| New bounded context (Prisma) | `/new-domain` |
| New bounded context (DynamoDB) | `/new-domain-dynamo` |
| Feature / ACL on existing backend domain | `/new-feature` (apply the `sync-cross-service-call` skill for ACL) |
| SQS publisher / consumer / **choreography saga** | `/new-event-service` (apply the `choreography-saga` skill) |
| Webapp page | `/webapp-feature` |
| Backend + webapp slice | `/full-stack-feature` |
| Mobile screen | `/mobile-feature` |
| E2E tests | `/new-e2e-tests` |
| CSV → issues | `/import-estimate-csv` then `docs/AI_ISSUE_CREATOR_PROMPT.md` |

See the [engineering handbook](../docs/engineering-handbook.md) and [CLAUDE.md](../CLAUDE.md) for the
authoritative rules — these briefs intentionally **link to**, rather than copy, those sources.
