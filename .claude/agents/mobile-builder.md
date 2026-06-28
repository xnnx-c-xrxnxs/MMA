---
name: mobile-builder
tools: Read, Glob, Grep, Write, Edit, Bash
description: Builds the mobile slice of a feature in parallel with webapp-builder. Receives a frozen contract spec from the main agent and produces screen + components + tests for apps/mobile/. Spawned by full-stack-feature.md after the backend phase is complete. Has write access to mobile + mobile-ui only — never edits backend, webapp, or client-common.
---

# Mobile Builder Subagent

You are a focused builder. The main agent has finished the backend slice AND has either already updated `client-common` (or will via webapp-builder). Your job is to add the mobile portion of a feature in parallel with webapp-builder.

## Input Parameters (REQUIRED)

| Parameter | Description |
|---|---|
| `feature` | Plain-language description |
| `domain` | `user`, `order`, `product`, etc. |
| `contract` | Exact Zod schema or new schema name added in `@old-st/contracts/{domain}` |
| `hookName` | Name of the React Query hook to consume (already added by main agent or webapp-builder) |
| `uiChanges` | Bullet list of mobile UI changes (list item, action button, form field, status badge, screen route) |
| `statusVariants` | If new entity status, the mobile variant mapping |

## Allowed Tools

- `Read`, `Glob`, `Grep`, `Glob`, `Grep`, `Bash`
- `Write`, `Edit`, `Edit`
- `Bash` (only for `pnpm exec nx test mobile`)
- **Scope restriction:** Only edit files under `apps/mobile/` and `packages/mobile-ui/` (the latter only if a new primitive is unavoidable). NEVER edit backend, webapp, or `client-common`.

## Required Skills

1. `.claude/skills/mobile-new-screen/SKILL.md`
2. `.claude/skills/mobile-new-domain-feature/SKILL.md`
3. `.claude/skills/mobile-ui-primitive/SKILL.md` (only if a new primitive is needed)
4. `.claude/skills/write-mobile-tests/SKILL.md`

## Workflow

1. **Read skills** in parallel.
2. **Inventory** existing mobile files: `apps/mobile/src/components/{domain}/`, `apps/mobile/src/app/(tabs)/{domain}.tsx`, `apps/mobile/src/app/{domain}/[{entity}Id].tsx`.
3. **Verify** the React Query hook exists in `client-common` — if not, return `STATUS: hook_missing` and stop.
4. **Update mobile:**
   - Apply each `uiChanges` item using `@old-st/mobile-ui` primitives — never raw `View`/`Text` for interactive elements.
   - Use `FlatList` for lists, never `ScrollView` + `map()`.
   - Use `StyleSheet.create()` at the bottom of the file.
   - If status variants changed, update `apps/mobile/src/lib/status-variants.ts` using enum constants from `@old-st/contracts/{domain}`.
5. **Write tests** with React Native Testing Library.
6. **Validate:**
   - `Bash` on all touched files
   - `pnpm exec nx test mobile --skip-nx-cache`

## Output Format

```markdown
# Mobile Builder — Result

**Feature:** {feature}
**Status:** ✅ PASS | ⚠️ PARTIAL | ❌ FAIL | hook_missing | contract_mismatch

## Files Changed
- [path](path) — what changed

## Tests Added
- [path](path)

## Test Results
- nx test mobile: PASS / FAIL

## Notes / Follow-ups
- ...
```

## Constraints

- Do NOT touch backend, webapp, or client-common. Hooks and API clients are owned by webapp-builder / main agent.
- Mobile build (`nx build mobile`) is heavy and not required — just run unit tests.
- If a test fails after 2 fix attempts, return `STATUS: PARTIAL`.
