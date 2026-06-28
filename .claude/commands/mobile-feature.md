---
description: "Add a new mobile screen or feature — tab screen, detail screen, form, action, or list. USE WHEN user says 'add a mobile screen', 'add a screen to the app', 'mobile feature', 'add a tab', 'create a mobile page', or describes any mobile-only addition. Supports both UI-first (mock data) and integrated (live API) modes."
---

# Mobile Feature — Guided Workflow

You are orchestrating the addition of a new screen or feature to the Expo mobile app. The workflow supports two modes:

- **Integrated mode** (default) — backend endpoints + hooks exist; screens wire real data end-to-end.
- **UI-first mode** — build screens and components with mock data first, wire API integration later. Useful when the backend isn't ready, when iterating on design, or when working on the UI layer independently.

Full mobile conventions: `docs/mobile-development-handbook.md`.

**Do NOT generate any code until Phase 0 (Interview) is complete.**

---

## Phase 0 — Interview

Ask the following in a single structured message and wait for answers.

### Required Information

1. **What is the user-facing capability?** (e.g. "list active orders", "view user profile", "create a payment")
2. **Which domain?** (`auth`, `users`, `orders`, `products`, or a new domain)
3. **Screen type:**
   - **Tab screen** — bottom tab with a list + filter?
   - **Detail screen** — single entity with actions (navigated from a list)?
   - **Form screen** — create/edit form?
   - **Modal/sheet** — overlay action (confirm, filter)?
   - **Standalone screen** — not in tabs (auth screens, onboarding)?
4. **Mode:**
   - **Integrated** — backend endpoints exist; wire real API hooks now (default).
   - **UI-first** — build screens with mock data; integrate API later.
5. **Which API endpoints does it call?** (list them with the matching `@mma/client-common` hook names, e.g. `useUsersByStatus`, `useCreateOrder`) — *Integrated mode: required. UI-first mode: list expected endpoints if known, or skip.*
6. **Are there forms?** (If yes, which contract Zod schema from `@mma/contracts/{domain}`?) — *UI-first mode: describe the fields even if the schema doesn't exist yet.*
7. **Does the entity have statuses?** (If yes, which statuses → which badge variants?)
8. **What actions are available?** (e.g. activate, deactivate, delete — driven by entity status)
9. **Does it need any new shared UI primitive** beyond what's in `@mma/mobile-ui`?

### Auto-Detection

- If the user names a domain, auto-detect the contract package: `@mma/contracts/{domain}`.
- Check if hooks already exist in `packages/client-common/src/hooks/use-{domain}.ts`.
- Check if status-variant mapping already exists in `apps/mobile/src/lib/status-variants.ts`.
- **Mode auto-detection:** If the user says "mock", "placeholder", "UI first", "no backend yet", "design first", or "just the screens" → default to **UI-first mode**. If hooks and contracts already exist for the domain → suggest **Integrated mode**.

**Do not proceed until questions 1–4 and 7–8 are answered.** Questions 5–6 may be deferred in UI-first mode.

---

## Phase 0.5 — Pre-flight Discovery (parallel subagents)

Fan out **read-only** subagents in parallel:

- `Agent(subagent_type="prompt-skill-loader", prompt="Pre-load these skills as a digest: mobile-new-screen, mobile-new-domain-feature, webapp-api-client-hooks, mobile-ui-primitive, mobile-form-with-validation, mobile-navigation-patterns, write-mobile-tests")`
- `Agent(subagent_type="domain-explorer", prompt="domain={domain}, focus=contracts+client-common, thoroughness=quick")`

Wait for all to return. Summarize what already exists (hooks, status enums, components) and the file plan, then confirm with the user.

---

## Phase 1 — API Hooks (only if missing)

> **UI-first mode: SKIP this phase entirely.** Mock data replaces hooks in Phase 6.

**Load skill:** `.claude/skills/webapp-api-client-hooks/SKILL.md`

If the required hooks (`use{Domain}`, `useCreate{Entity}`, mutation hooks) do not yet exist in `packages/client-common/src/hooks/use-{domain}.ts`, add them now. Re-export from `packages/client-common/src/hooks/index.ts`.

Hooks and API clients live in `@mma/client-common` — shared by webapp and mobile. **Never create mobile-only API clients or hooks.**

If hooks already exist, skip this phase.

After this phase, run:
```
Bash(filePaths=["packages/client-common/src/hooks/use-{domain}.ts", "packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts"])
```

---

## Phase 2 — UI Primitives (only if missing)

If the screen needs a primitive not yet in `@mma/mobile-ui` (e.g. Switch, BottomSheet, SearchBar), add it.

**Load skill:** `.claude/skills/mobile-ui-primitive/SKILL.md`

Create the component in `packages/mobile-ui/src/components/`, export from `packages/mobile-ui/src/index.ts`.

Rules:
- Use theme tokens from `../lib/theme` — never hardcode colors.
- Use `StyleSheet.create()` for styles.
- Follow existing primitives (Button, Card, Input) as reference.

Skip this phase if existing primitives are sufficient.

---

## Phase 3 — Status-Variant Mapping (if entity has statuses)

File: `apps/mobile/src/lib/status-variants.ts`

Add a variant mapper function for the entity:

```typescript
import { {Entity}StatusEnum } from '@mma/contracts/{domain}';
import type { BadgeVariant } from '@mma/mobile-ui';

export function {entity}StatusVariant(status: string): BadgeVariant {
  switch (status) {
    case {Entity}StatusEnum.ACTIVE: return 'success';
    case {Entity}StatusEnum.PENDING: return 'warning';
    case {Entity}StatusEnum.INACTIVE: return 'secondary';
    default: return 'outline';
  }
}
```

Rules:
- Import status enum from `@mma/contracts/{domain}` — never hardcode strings.
- Always include a `default` fallback.

**UI-first mode:** If the contracts package doesn't exist yet, use string literal constants with a `// TODO: replace with {Entity}StatusEnum from @mma/contracts/{domain}` comment:

```typescript
import type { BadgeVariant } from '@mma/mobile-ui';

// TODO: replace with {Entity}StatusEnum from @mma/contracts/{domain}
const STATUS = { ACTIVE: 'ACTIVE', PENDING: 'PENDING', INACTIVE: 'INACTIVE' } as const;

export function {entity}StatusVariant(status: string): BadgeVariant {
  switch (status) {
    case STATUS.ACTIVE: return 'success';
    case STATUS.PENDING: return 'warning';
    case STATUS.INACTIVE: return 'secondary';
    default: return 'outline';
  }
}
```

Skip if the domain already has a mapper or the entity has no statuses.

---

## Phase 4 — Domain Components

**Load skill:** `.claude/skills/mobile-new-screen/SKILL.md`

Create domain-scoped components in `apps/mobile/src/components/{domain}/`:

- **`{domain}-list.tsx`** — `FlatList` with `Card` items for list screens.
- **`{domain}-detail-card.tsx`** — entity detail display for detail screens.
- **`{domain}-actions.tsx`** — status-driven action buttons (conditional by entity state).
- **`{domain}-form.tsx`** — `react-hook-form` + Zod resolver for create/edit forms.

Each component:
- Uses `@mma/mobile-ui` primitives — never raw `View`/`Text` for interactive elements.
- Accepts data via props — screens fetch, components render.
- Uses `StyleSheet.create()` at the bottom of the file.
- Uses theme tokens for colors, spacing, radii.

**Prop typing rule (both modes):** Components MUST define explicit prop interfaces. In **integrated mode**, import response types from `@mma/contracts/{domain}`. In **UI-first mode**, if contracts don't exist yet, define a local `{Entity}Item` type in the component file with a `// TODO: replace with {Entity}Response from @mma/contracts/{domain}` comment. This ensures the integration retrofit (Phase 9) is a type-import swap, not a component rewrite.

After this phase, run:
```
Bash(filePaths=["apps/mobile/src/components/{domain}/"])
```

---

## Phase 5 — Forms (if applicable)

**Load skill:** `.claude/skills/mobile-form-with-validation/SKILL.md`

For each form (create / edit):
- Use `react-hook-form` + `zodResolver` with `Controller` (not `register` — no DOM refs in RN).
- Source schema from `@mma/contracts/{domain}` — never duplicate.
- Wrap in `KeyboardAvoidingView` + `ScrollView` with `keyboardShouldPersistTaps="handled"`.
- Use `Input` from `@mma/mobile-ui` with manual error `<Text>` below each field.
- Use `Button` from `@mma/mobile-ui` with `loading={mutation.isPending}`.
- For password fields, use the `PasswordField` pattern from the skill (secureTextEntry toggle).
- Wire mutation `onSuccess` to navigation (e.g. `router.back()`) and `isError` to inline error display.

**Important:** Do NOT use `<Form>`, `<FormField>`, `<FormItem>`, `<FormControl>`, or `<FormMessage>` from `@mma/ui` — these are web-only components that use Radix Slot and `<form>` elements.

---

## Phase 6 — Screen (Orchestrator)

Create the screen file:

- **Tab screen:** `apps/mobile/src/app/(tabs)/{domain}.tsx`
- **Detail screen:** `apps/mobile/src/app/{domain}/[{entity}Id].tsx`
- **Auth screen:** `apps/mobile/src/app/(auth)/{screen}.tsx` — load `mobile-auth-screens` skill
- **Standalone screen:** `apps/mobile/src/app/{path}.tsx`

Screen rules:
- **Thin orchestrator** — wire hooks → state → child components. No list markup or form fields inline.
- Use `SafeAreaView` from `react-native-safe-area-context` for screen containers.
- Use `useLocalSearchParams()` for route params in detail screens.
- Show `Spinner` from `@mma/mobile-ui` for loading state.
- Show `EmptyState` from `@mma/mobile-ui` when no data.

### Integrated mode (default)

- Use hooks from `@mma/client-common` for all data fetching.
- Wire `isLoading`, `data`, and mutation hooks to child components.

### UI-first mode

Screens use a **mock data module** instead of hooks. Create a file per domain:

**File:** `apps/mobile/src/mocks/{domain}.ts`

```typescript
// TODO: Remove this file when integrating with real API (Phase 9)

export const MOCK_{ENTITIES} = [
  {
    {entity}Id: '1',
    name: 'Sample {Entity} 1',
    {entity}Status: 'ACTIVE',
    dateCreated: '2025-01-15T10:00:00Z',
  },
  {
    {entity}Id: '2',
    name: 'Sample {Entity} 2',
    {entity}Status: 'PENDING',
    dateCreated: '2025-02-20T14:30:00Z',
  },
];

export const MOCK_{ENTITY}_DETAIL = MOCK_{ENTITIES}[0];
```

Screen pattern for UI-first:

```typescript
import { useState } from 'react';
import { MOCK_{ENTITIES} } from '../../mocks/{domain}';

export default function {Entity}sScreen() {
  // TODO: Replace with use{Entity}sByStatus() from @mma/client-common
  const [isLoading] = useState(false);
  const {entity}s = MOCK_{ENTITIES};

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <{Entity}sList {entity}s={{entity}s} isLoading={isLoading} />
    </SafeAreaView>
  );
}
```

**Rules for mock data:**
- Mock data shapes MUST match the expected API response shape (same field names, same nesting). This ensures components don't need restructuring during integration.
- Keep mock data realistic — use plausible values, multiple items with different statuses.
- All mock files go in `apps/mobile/src/mocks/` — never scatter inline mock objects across screens.
- Every mock usage has a `// TODO:` comment naming the exact hook that will replace it.
- Mutations in UI-first mode use no-op callbacks with `Alert.alert('TODO', 'Wire {action} mutation')` so the UI flow is testable.

---

## Phase 7 — Navigation Wiring

**Load skill:** `.claude/skills/mobile-navigation-patterns/SKILL.md`

### If adding a new tab:

Register in `apps/mobile/src/app/(tabs)/_layout.tsx`:

```tsx
<Tabs.Screen
  name="{domain}"
  options={{
    title: '{Domain}',
    tabBarIcon: ({ color, size }) => <Ionicons name="{icon}" size={size} color={color} />,
  }}
/>
```

### If adding a detail screen:

Ensure the list component navigates via `useRouter().push('/{domain}/{id}')`.

### If adding an auth screen:

Add to the `(auth)/_layout.tsx` Stack. Follow the `mobile-auth-screens` skill for the full auth flow pattern including auth guard in root layout.

---

## Phase 8 — Tests

**Load skill:** `.claude/skills/write-mobile-tests/SKILL.md`

Test files are co-located next to their source files:

| Source | Test |
|---|---|
| `src/components/{domain}/{domain}-list.tsx` | `src/components/{domain}/{domain}-list.spec.tsx` |
| `src/components/{domain}/{domain}-form.tsx` | `src/components/{domain}/{domain}-form.spec.tsx` |
| `src/lib/status-variants.ts` | `src/lib/status-variants.spec.ts` |

What to test:
- **List component** — renders items, empty state, loading state, navigation on press.
- **Form component** — valid submit calls mutation, invalid submit shows errors.
- **Status-variant function** — each status returns correct badge variant.
- **Action buttons** — conditional rendering by entity status.

Run:
```
pnpm nx test mobile
```

---

## Phase 9 — Integration Retrofit (UI-first mode only)

This phase runs **later**, when the backend and hooks are ready. It can be triggered by saying "integrate {domain} screens" or "wire up {domain} API".

**Load skill:** `.claude/skills/webapp-api-client-hooks/SKILL.md`

### Step-by-step

1. **Create/verify hooks** — follow Phase 1 (API Hooks). Ensure hooks exist in `packages/client-common/src/hooks/use-{domain}.ts`.

2. **Replace mock data in screens** — for each screen that imports from `mocks/{domain}.ts`:
   - Replace mock import with the corresponding hook: `MOCK_{ENTITIES}` → `use{Entity}sByStatus()`, `MOCK_{ENTITY}_DETAIL` → `use{Entity}({entity}Id)`.
   - Replace `const [isLoading] = useState(false)` with `const { data, isLoading } = useHook()`.
   - Replace no-op mutation callbacks with real mutation hooks.

3. **Replace local types with contract imports** — for each component with a `// TODO: replace with ... from @mma/contracts/{domain}` comment:
   - Import the real response type.
   - Delete the local `{Entity}Item` type.

4. **Replace status constants** — in `status-variants.ts`, replace the inline `STATUS` object with `{Entity}StatusEnum` from `@mma/contracts/{domain}`.

5. **Delete mock files** — remove `apps/mobile/src/mocks/{domain}.ts`.

6. **Verify** — run:
   ```
   Bash(filePaths=["apps/mobile/src/"])
   pnpm nx test mobile
   ```

### Integration checklist (copy-paste for PR description)

```markdown
- [ ] Hooks created/verified in `packages/client-common/src/hooks/use-{domain}.ts`
- [ ] All `mocks/{domain}.ts` imports replaced with hook calls
- [ ] All local `{Entity}Item` types replaced with contract types
- [ ] Status-variant mapper uses `{Entity}StatusEnum` from contracts
- [ ] `apps/mobile/src/mocks/{domain}.ts` deleted
- [ ] No remaining `// TODO:` comments referencing mock replacement
- [ ] `pnpm nx test mobile` passes
```

---

## Final Verification

Run in order:
1. `pnpm tsx scripts/lint-standards.ts` — no new violations.
2. `pnpm nx test mobile` — all pass, 70% coverage threshold met.
3. `pnpm nx build mobile` — build succeeds (or `pnpm nx serve mobile` starts without errors).

**UI-first mode additional check:** Search for orphaned TODO markers:
```bash
grep -rn 'TODO:.*Replace with\|TODO:.*replace with\|TODO:.*Wire\|TODO:.*Remove this file' apps/mobile/src/ || echo 'No TODO markers found — integration complete'
```

Surface any failures to the user before claiming done.
