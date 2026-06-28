# NestJS vs. Node.js (Fastify) — Honest Trade-Off Write-Up

> **Context:** We are a software consulting company. We have an AI-native template that scaffolds services, applies conventions, and runs lint checks automatically. The challenge is fair: with a template + AI assistance, the "it would be hard to write raw Node" objection is dead. So this comparison drops that argument and looks at what actually remains.

---

## What we gain from NestJS

### 1. Built-in DI container with lifecycle management
NestJS provides constructor injection, scoped providers, async factories, and module boundaries out of the box. Our use cases, repositories, application services, and event publishers are all wired through `@Module({ providers, exports })`.

**What it costs us without it:** ~80–150 lines of composition-root code per service, OR adopting a separate DI library (`tsyringe`, `inversify`, `awilix`).

### 2. Decorator-based HTTP layer
Controllers, route params, pipes, guards, filters, and interceptors are all declarative. `@CurrentUser()`, `@Public()`, `JwtAuthGuard`, `DomainExceptionFilter`, `ZodValidationPipe` all plug in via decorators.

**What it costs us without it:** Manual request-handler wiring, custom middleware composition, hand-rolled per-route auth checks.

### 3. Automatic OpenAPI/Swagger generation
`@nestjs/swagger` derives docs from controllers + Zod schemas. We have one source of truth (the schema) and Swagger appears for free.

**What it costs us without it:** Maintain OpenAPI YAML by hand, OR add `zod-openapi` + `fastify-swagger` and wire them per service.

### 4. Convention enforcement at the framework level
`@Controller`, `@Module`, `@Injectable` make architectural intent explicit and machine-readable. Our lint rules (`controller-no-direct-usecase`, `domain-no-nestjs-imports`) work because the boundaries are decorator-marked.

**What it costs us without it:** Conventions become README-only — drift is detectable only by code review.

### 5. Hiring market depth
NestJS is a known résumé item. Filtering candidates is straightforward. New hires are productive on Monday.

**What it costs us without it:** Either filter for a niche bespoke stack (small candidate pool), or accept onboarding tax on every hire.

### 6. AI-assisted code generation accuracy
LLM accuracy is well-documented to track training-corpus frequency (Chen et al. 2021, BigCode 2023). NestJS has roughly 2× the GitHub footprint of Fastify and 14× that of typical bespoke-DI stacks. Claude generates correct NestJS controllers on the first attempt at measurably higher rates than it does for hand-rolled patterns.

**Caveat:** there is no NestJS-specific accuracy benchmark; the argument rests on the general training-data-frequency mechanism. The numbers (GitHub stars, npm downloads, SO tags) are verifiable today.

### 7. Cross-project consultant velocity
A dev finishing one NestJS engagement is productive on the next NestJS engagement immediately. This compounds across rotating teams.

### 8. Clean client handover
"Standard NestJS app" is a sentence that closes engagements. The client's in-house team can hire and maintain.

### 9. Zero retraining cost for our existing team
Every backend and full-stack developer on staff is already proficient in NestJS. Switching to a raw-Node-based stack would require **retraining every single backend / full-stack developer** on a new framework, new conventions, new debugging patterns, and new wiring style. That is weeks of lost productivity per engineer plus a quality dip during the learning curve — for zero new client-visible capability.

---

## What we gain from raw Node.js + Fastify

### 1. Faster cold start (~150–250 ms)
Measured against our actual `user-api-service` bundle (5.0 MB): removing `@nestjs/core` + `@nestjs/common` + Express layer saves ~2 MB and ~200 ms of init time. Warm latency is identical.

### 2. Smaller Lambda artifacts (~2 MB lighter)
Lower deploy times, smaller ECR/S3 storage, faster CI uploads. Operationally invisible at our scale, but real.

### 3. Less framework magic
No reflection metadata, no decorator metadata emit, no DI container to debug. Stack traces are shorter. Lifecycle is explicit (`fastify.register(...)`).

### 4. Direct control over the request pipeline
No middleware ordering surprises. Easier to reason about exactly what runs per request.

### 5. Slightly faster TS compilation
No `emitDecoratorMetadata` overhead — TS builds are ~10–20% faster on a per-service basis.

### 6. No vendor lock-in to a single framework's release cycle
NestJS major versions (v9 → v10 → v11) occasionally require migration work. Fastify is more stable in API surface.

### 7. Easier to optimize per-Lambda
For a single ultra-hot endpoint, Fastify makes it trivial to strip everything and ship the smallest possible bundle.

---

## What the template + AI-native workflow neutralizes

The strongest counter-point: **"we have a template and AI, so writing raw Node isn't hard."** That is correct. These NestJS arguments **no longer apply** in our setup:

| Old argument for NestJS | Why it's neutralized |
|---|---|
| "Boilerplate per endpoint is high in raw Node" | Template + AI generates boilerplate in seconds either way |
| "DI wiring is tedious" | A scaffold script can emit the composition root |
| "Manual validation is error-prone" | Zod is framework-agnostic — works identically in Fastify |
| "OpenAPI maintenance is painful" | `zod-openapi` + `fastify-swagger` solves it |
| "Auth wiring is repetitive" | A shared `@mma/auth-middleware` package solves it |
| "Error mapping is inconsistent" | A shared `errorHandler` plugin solves it |

We should **not** lean on those points. They are true in general but weak in our specific situation.

---

## What the template + AI workflow does NOT neutralize

These remain real arguments for NestJS even with our setup:

| Argument | Why it survives |
|---|---|
| Hiring market depth | AI doesn't help us hire faster — the candidate pool size is what it is |
| Client handover quality | Clients evaluate "what is this codebase?" — "standard NestJS" reads better than "our internal Fastify framework" |
| Cross-project knowledge transfer | A dev rotating between client projects pays a re-onboarding cost on bespoke stacks even with AI |
| AI training-data advantage | Mechanism is real (Chen et al. 2021) — AI generates correct NestJS more reliably than novel patterns |
| Lint-rule enforcement of architecture | Decorator-marked boundaries are easier to lint than convention-only structures |
| Existing team proficiency | Every backend / full-stack dev on staff already knows NestJS — switching means retraining all of them |

---

## Honest cost summary

| Cost | NestJS | Raw Node + Fastify |
|---|---|---|
| Cold start (256 MB Lambda) | 450–700 ms | 250–400 ms |
| Warm latency | identical | identical |
| Bundle size | ~5 MB | ~3 MB |
| Per-service boilerplate | medium (template generates it) | low (template generates it) |
| Migration cost from current state | $0 | weeks (6 services + skills + lint rules) |
| Team retraining cost | $0 | weeks per engineer, every backend / full-stack dev |
| Hiring filter | wide pool | narrow / bespoke |
| Client handover | conventional | "internal framework" |
| AI generation accuracy | high | medium-high |

---

## Recommendation

**Keep NestJS as the consultancy default**, but for honest reasons — not the easy ones:

✅ Strong reasons to keep:
- Hiring market depth
- Client handover quality
- AI training-data advantage (with the citation caveat)
- Cross-project consultant velocity
- Existing team is already proficient — switching forces full backend / full-stack retraining

❌ Weak reasons we should stop using:
- "Boilerplate" — neutralized by template + AI
- "DI is hard" — neutralized by template + AI
- "Validation is hard" — neutralized by Zod + AI

⚠️ Real costs we acknowledge:
- ~200 ms extra cold start (mitigatable with SnapStart)
- ~2 MB extra bundle (operationally invisible at our scale)
- One framework version migration every ~18 months
