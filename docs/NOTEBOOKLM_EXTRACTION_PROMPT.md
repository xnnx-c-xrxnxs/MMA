# NotebookLM Project Context Extraction Prompts

> **Purpose:** Paste the prompts below — one at a time — into [Google NotebookLM](https://notebooklm.google.com) after uploading your project's source documents (BRDs, specs, design notes, meeting minutes, existing READMEs). Each prompt produces ONE small block. You then paste all blocks into Claude Code via `/sync-notebooklm-output`, which validates and applies them.
>
> **Why four small prompts and not one big one.** NotebookLM has an input length limit and tends to truncate or refuse very long prompts. A single mega-prompt also produces one giant response that often hits NotebookLM's output cap before all sections are emitted. Splitting the work into four short, focused prompts keeps each round well within the limits and gives you a chance to review each block before moving on.
>
> **What this template already pins.** NestJS, Next.js, Expo, DynamoDB / Prisma, AWS Cognito, Terraform, Nx. NotebookLM does **not** need to extract any of that — it only extracts what genuinely varies per project: bounded contexts, user roles, domain entities, business rules, NFRs, and integrations.
>
> **Persistence choice (DynamoDB vs Prisma) is YOUR call, not NotebookLM's.** All four prompts deliberately tell NotebookLM to emit `"[TODO: dynamodb or prisma]"` for every domain. You confirm the choice per-domain when you run `/sync-notebooklm-output` in Claude Code. This is intentional — persistence is an architectural decision that depends on access patterns, not a fact NotebookLM can read from a BRD.

---

## How to Use

1. **Upload sources to NotebookLM** — BRDs, technical specs, architecture diagrams (PDF), design files, API contracts, meeting notes, existing READMEs. The more context, the better.
2. **Paste Prompt 1** (below) → copy the `JSON_FOR_ISSUE_CONFIG` block to a scratch file.
3. **Paste Prompt 2** → copy the `MARKDOWN_PART_1_PROJECT_AND_ROLES` block.
4. **Paste Prompt 3** → copy the `MARKDOWN_PART_2_ENTITIES` block.
5. **Paste Prompt 4** → copy the `MARKDOWN_PART_3_RULES_AND_NFRS` block.
6. **Sync into the repo** — open Claude Code and run `/sync-notebooklm-output`. It will accept the four blocks (one at a time or all at once), interview you about persistence per domain, validate, and apply.
7. **Run the seed task** — VS Code task `GitHub: Seed Issue Labels` (this picks up new domains).

---

## 📋 Prompt 1 — Bounded Contexts (paste this first)

````
You are extracting bounded-context metadata for a software project. The target
codebase already has a FIXED tech stack chosen outside of this extraction:
NestJS, Next.js, Expo, DynamoDB OneTable + Prisma/PostgreSQL, AWS Cognito,
Terraform, Nx. Do NOT comment on, suggest, or extract anything about the tech
stack — assume it is already decided. Focus ONLY on bounded contexts.

Output ONE fenced block, labelled exactly `JSON_FOR_ISSUE_CONFIG`, with this shape:

```json
{
  "projectName": "<kebab-case repo name>",
  "ticketPrefix": "<2-5 uppercase letters used in ticket IDs, e.g. ACME, ORD, PROJ>",
  "domains": [
    {
      "name": "<lowercase singular bounded-context name, e.g. user, order, invoice>",
      "description": "<one short sentence — what this context owns>",
      "persistence": "[TODO: dynamodb or prisma]"
    }
  ],
  "crossCutting": [
    { "name": "webapp",       "description": "Next.js webapp UI",            "color": "0366d6" },
    { "name": "mobile",       "description": "Expo mobile app",              "color": "0366d6" },
    { "name": "infra",        "description": "Terraform / CD / AWS",         "color": "5319e7" },
    { "name": "cross-domain", "description": "Spans 2+ bounded contexts",    "color": "ff6b6b" },
    { "name": "new-domain",   "description": "New bounded context to scaffold", "color": "b60205" }
  ]
}
```

EXTRACTION RULES for `domains[]`:
- One entry per **bounded context** (DDD sense): a coherent business capability with
  its own ubiquitous language. Examples: user, order, product, invoice, shipping,
  notification, payment, catalogue, subscription.
- DO NOT create domains for generic cross-cutting platform surfaces — specifically
  authentication, file upload/storage, and monitoring/observability — as these are
  already provided by the underlying platform. Only add them if the source documents
  describe **custom** auth, storage, or monitoring logic that goes beyond standard
  sign-in / presigned-URL uploads / CloudWatch-style metrics.
- Use lowercase singular names (`order` not `orders`, `invoice` not `invoicing`).
- ALWAYS set `persistence` to the literal string `"[TODO: dynamodb or prisma]"`. The
  human will choose per-domain after extraction. Do not guess.
- Use `[TODO: ...]` for projectName / ticketPrefix if not stated in the documents.

Output ONLY the fenced JSON_FOR_ISSUE_CONFIG block. No commentary.
````

---

## 📋 Prompt 2 — Project Overview + User Roles (paste second)

````
Extract the project overview and user-role catalogue for a software project. Output
ONE fenced block, labelled exactly `MARKDOWN_PART_1_PROJECT_AND_ROLES`, with this
exact structure (keep section numbers — they merge into an existing template file):

```markdown
## 1. What This Project Is

**Project name:** <official project name>
**Repository:** <git URL if known, otherwise [TODO: repo URL]>
**Purpose:** <1–2 sentences — what business problem does this solve?>
**Description:** <2–4 sentences — what does the system actually do, end-to-end?>
**Key source documents:** <bullet list of the BRD / spec / design files this was extracted from>

---

## 3. User Roles

For each role, document name, access level, capabilities, and restrictions.
Use this format:

### `<ROLE_NAME>` (e.g. `ADMIN`, `CUSTOMER`, `STAFF`, `VIEWER`)
- **Access level:** <Full / Standard / Restricted / Read-only>
- **Capabilities:**
  - <action 1>
  - <action 2>
- **Restrictions:**
  - <what they CANNOT do>
- **Auth:** <Email/Password / SSO / MFA / Public>

(Repeat per role. If no custom roles are mentioned, default to ADMIN + USER + GUEST
and mark the section with `[TODO: confirm role catalogue]`.)
```

RULES:
- Output ONLY the fenced MARKDOWN_PART_1_PROJECT_AND_ROLES block.
- Use `[TODO: ...]` for any field the source documents do not state.
- Never invent technologies, services, or roles not present in the documents.
````

---

## 📋 Prompt 3 — Domain Entities (paste third)

````
Extract every domain entity referenced in the uploaded documents. Output ONE fenced
block, labelled exactly `MARKDOWN_PART_2_ENTITIES`, with this exact structure:

```markdown
## 11. Domain Entities

For each entity, list:

### `<EntityName>` (lives in `<domain>` domain)
- **Key fields:** `<field>: <type>`, `<field>: <type>` …
- **Status / state machine:** <list states + transitions, or "stateless">
- **Relationships:** <e.g. "belongs to User; has many OrderItem">
- **Notes:** <any business invariants found in source docs>
```

RULES:
- Output ONLY the fenced MARKDOWN_PART_2_ENTITIES block.
- Skip generic CRUD verbs — only list real entities (nouns the business cares about).
- The `<domain>` value MUST match a `domains[].name` you produced in Prompt 1.
- Mark unclear field types with `[TODO: ...]`.
- Never invent entities not present in the documents.
````

---

## 📋 Prompt 4 — Business Rules + NFRs (paste fourth)

````
Extract business rules and non-functional requirements. Output ONE fenced block,
labelled exactly `MARKDOWN_PART_3_RULES_AND_NFRS`, with this exact structure:

```markdown
## 12. Project-Specific Business Rules

Extract every rule expressed with words like "must", "should", "always", "never",
"required", "forbidden", "only when", "cannot". Group by domain.

### `<domain>`
- <rule 1, with the source document reference if possible>
- <rule 2>

(If the source documents have no explicit rules for a domain, write
`[TODO: gather business rules from product owner]` for that domain.)

---

## 13. Project-Specific Integrations & NFRs

### Third-party integrations
- <Integration name, purpose, direction (incoming webhook / outgoing API call)>

### File upload / processing
- **Accepted formats:** <list>
- **Size limits:** <e.g. 10 MB>
- **Validation rules:** <e.g. virus scan, MIME sniff, schema check>

### Performance targets
- <e.g. "p95 API response < 300 ms", "support 5k concurrent users">

### Security / compliance
- <e.g. "GDPR right-to-be-forgotten", "PCI-DSS scope: payments domain", "MFA mandatory for ADMIN">

### Browser / device support
- <list>

### Other NFRs
- <anything else explicit in the source docs>
```

RULES:
- Output ONLY the fenced MARKDOWN_PART_3_RULES_AND_NFRS block.
- The `<domain>` value MUST match a `domains[].name` from Prompt 1.
- Mark missing values with `[TODO: ...]`.
- Never invent rules, integrations, or NFRs not present in the documents.
````

---

## Follow-Up Questions to Refine

If any pass is sparse, ask NotebookLM:

- "List every API endpoint or workflow described in the source documents and group them by domain."
- "What entity status values and state transitions are mentioned?"
- "What validation rules apply to file uploads?"
- "Which actions require ADMIN privileges?"
- "Are there any rate limits, SLAs, or compliance requirements (GDPR, HIPAA, PCI, SOC 2)?"
- "What third-party services are integrated (payment, email, SMS, analytics)?"

Then re-run the affected prompt and re-paste the resulting block to `/sync-notebooklm-output` — the sync workflow is idempotent and replaces sections in place.

---

## When to Re-Run the Extraction

- New BRD or major scope change → re-run all four prompts.
- New entity → re-run **Prompt 3** only.
- New rule / NFR → re-run **Prompt 4** only.
- New role → re-run **Prompt 2** only.
- New / removed domain → re-run **Prompt 1** AND re-run anything that referenced the changed domain.

After re-running, run `/sync-notebooklm-output` again — it accepts partial updates.

---

## Related

- [.github/issue-config.json](../.github/issue-config.json) — labels source of truth.
- [docs/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — final destination of Prompts 2–4.
- [docs/AI_ISSUE_CREATOR_PROMPT.md](AI_ISSUE_CREATOR_PROMPT.md) — consumes the project context to generate issues.
- [docs/QUICK_START_BA.md](QUICK_START_BA.md) — full BA bootstrap guide.
- [.claude/commands/sync-notebooklm-output.md](../.claude/commands/sync-notebooklm-output.md) — Claude Code workflow that applies the NotebookLM output.
