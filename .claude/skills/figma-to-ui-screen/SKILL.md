---
name: figma-to-ui-screen
description: Convert a full Figma screen / page (e.g. Dashboard, Project Detail, Settings) into a Next.js page in apps/webapp/. Decomposes the screen into sections, identifies which @mma/ui primitives are needed, distinguishes existing vs new primitives, then composes the page using the thin-orchestrator pattern. Use this when the user pastes a Figma URL pointing to a page-level frame (not a single component).
---

# Figma Screen → Next.js Page

This skill handles **screens** (compositions of many primitives). For a **single primitive**, use `figma-to-ui-component` instead.

> **Hard rule:** A screen is composed of primitives from `@mma/ui`. If you find yourself writing `<button>`, `<input>`, `<table>` directly in a page, stop — the primitive is missing and must be added first via `figma-to-ui-component`.

---

## Canonical references

- Skill chain: `figma-to-ui-component` (for any missing primitive) → this skill (composition) → `webapp-new-page` (for routing/layout/sidebar wiring)
- Existing pages (study these patterns first):
  - List + create + actions: [apps/webapp/src/app/(protected)/users/page.tsx](apps/webapp/src/app/(protected)/users/page.tsx)
  - Detail with conditional sections: [apps/webapp/src/app/(protected)/users/[userId]/page.tsx](apps/webapp/src/app/(protected)/users/[userId]/page.tsx)
- Layout shell: [apps/webapp/src/components/layout/sidebar.tsx](apps/webapp/src/components/layout/sidebar.tsx), [apps/webapp/src/components/layout/header.tsx](apps/webapp/src/components/layout/header.tsx)
- Tokens: [packages/ui/src/lib/tokens.ts](packages/ui/src/lib/tokens.ts)
- Primitive barrel (what already exists): [packages/ui/src/index.ts](packages/ui/src/index.ts)

---

## Phase 0 — Required information (ASK before tool calls)

1. **Figma URL?** (page-level frame — not a single component instance)
2. **Screen name?** (e.g. "Dashboard", "Project Detail", "Reports") — becomes the route segment
3. **Route path?** (e.g. `/dashboard`, `/projects/[projectId]`, `/reports`)
4. **Protected or public route?** (almost always protected — goes under `apps/webapp/src/app/(protected)/`)
5. **What domain(s) does this screen pull data from?** (e.g. "users + orders" — drives which hooks we'll need)
6. **Are the data hooks already in `@mma/client-common`?** (if not, chain into `webapp-api-client-hooks` first)
7. **Should it appear in the sidebar?** (default yes — drives sidebar wiring)
8. **Mobile mirror?** (default **no** for screens — mobile usually has its own simpler screen patterns; chain into `mobile-new-screen` only if explicitly requested)

If anything is unclear, **ask the user**. Do not guess routes or domains.

---

## Phase 1 — Pull the screen from Figma

Run in parallel:

1. `mcp__figma2__get_metadata` — returns the full frame tree (sections, child frames, instance references)
2. `mcp__figma2__get_screenshot` — returns a visual reference (CRITICAL — keep it open mentally throughout decomposition)
3. `mcp__figma2__get_design_context` — returns reference React + Tailwind (will be very long for a full screen — treat as guidance, not source of truth)
4. `mcp__figma2__get_variable_defs` — returns tokens used across the screen

**Then pause.** Do not start coding. Move to decomposition.

---

## Phase 2 — Decomposition (the core of the skill)

Produce a **screen breakdown table** as your first output to the user. Format:

```markdown
### Screen: Dashboard

| Section | Layout | Primitives needed | Status | Data source |
|---|---|---|---|---|
| Top stats row | 4-col grid | StatCard ×4 | ❌ NEW | useTodayStats() |
| Active timer panel | Card with inline form | Card, Input, Button (icon variant), Badge | ⚠️ Button.icon-only NEW | useActiveTimer() |
| Recent entries list | Vertical list inside Card | Card, EntryRow (custom) | ❌ NEW | useRecentEntries() |
| Sidebar item: "Dashboard" | NavLink in sidebar | (existing layout) | ✅ Existing | — |

**Primitives summary:**
- ✅ Already in `@mma/ui`: Card, Input, Button, Badge
- ❌ New primitives to build first: `StatCard`, `EntryRow`
- ⚠️ Existing primitive needs extension: `Button` (add `icon-only` variant if not present)

**Hooks summary:**
- ✅ Already in `@mma/client-common`: (none yet)
- ❌ New hooks to build first: `useTodayStats`, `useActiveTimer`, `useRecentEntries`
```

**The breakdown is a CHECKPOINT.** Show it to the user and **wait for confirmation** before proceeding. They may want to slice the screen down (e.g. "skip the recent entries section for now") or push back on a primitive choice (e.g. "EntryRow doesn't need to be a primitive, just inline it").

---

## Phase 3 — Resolve missing primitives FIRST

For every primitive marked `❌ NEW` or `⚠️ EXTEND`:

1. Open a **new chat or sub-task** for each one.
2. Apply the `figma-to-ui-component` skill — find the equivalent in Untitled UI (or design from scratch if it's a Time Tracker–specific component like `StatCard`), build the primitive, mirror to mobile if applicable, wire the barrel.
3. Confirm the primitive exists and tests pass before returning.

**Do NOT start composing the screen until every required primitive is in `@mma/ui`.** This is the single rule that prevents the "raw HTML soup in a page file" anti-pattern.

If a primitive is genuinely one-off (used only on this screen, conceptually inseparable from the screen — e.g. a `DashboardActiveTimer` panel that combines Card + Input + Button in a screen-specific way), then it lives as a **domain component** in `apps/webapp/src/components/{domain}/`, NOT in `@mma/ui`. Distinguish:

| | Goes in `@mma/ui` | Goes in `apps/webapp/src/components/{domain}/` |
|---|---|---|
| Reusable across screens | ✓ | |
| Generic (no domain coupling) | ✓ | |
| Domain-specific composition | | ✓ |
| Talks to a specific hook / mutation | | ✓ |
| Purely visual, no data-fetching | ✓ | |

Example: `StatCard` (label + number + trend) → `@mma/ui`. `ActiveTimerPanel` (uses `useActiveTimer()`, calls start/stop mutations) → `apps/webapp/src/components/timer/`.

---

## Phase 4 — Resolve missing hooks

For every hook marked `❌ NEW`:

- Chain into the `webapp-api-client-hooks` skill.
- Add the API client method + React Query hook + barrel export.
- Confirm the hook returns the shape the page expects.

**Do NOT proceed until all hooks exist.** Pages must never call `fetch` directly (Golden Rule #20).

---

## Phase 5 — Compose the page (thin orchestrator)

Once primitives + hooks exist, the page itself is small. Pattern:

File: `apps/webapp/src/app/(protected)/{route}/page.tsx`

```tsx
'use client';

import { useTodayStats, useActiveTimer, useRecentEntries } from '@mma/client-common';
import { Card, CardHeader, CardTitle, CardContent } from '@mma/ui';
import { StatCard } from '@mma/ui';
import { ActiveTimerPanel } from '@/components/timer/active-timer-panel';
import { RecentEntriesList } from '@/components/timer/recent-entries-list';

export default function DashboardPage() {
  const stats = useTodayStats();
  const activeTimer = useActiveTimer();
  const recentEntries = useRecentEntries({ limit: 10 });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today" value={stats.data?.todayHours ?? '—'} />
        <StatCard label="This week" value={stats.data?.weekHours ?? '—'} />
        <StatCard label="Active projects" value={stats.data?.activeProjects ?? '—'} />
        <StatCard label="Billable %" value={stats.data?.billablePct ?? '—'} />
      </div>

      {/* Active timer */}
      <ActiveTimerPanel data={activeTimer.data} />

      {/* Recent entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent entries</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentEntriesList entries={recentEntries.data ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
```

**Page-level rules (Golden Rule #19):**
- The page wires hooks → data → child components. That's it.
- No table markup, no form markup, no fetch calls in the page file.
- No status logic in the page — domain components or `lib/status-variants.ts` own that.
- Layout = Tailwind utility classes (`flex`, `grid`, `gap-*`, `p-*`) using semantic spacing. No raw pixel values.
- Dark mode is automatic if every primitive uses semantic tokens (which they should, after `figma-to-ui-component`).

---

## Phase 6 — Add `loading.tsx` + `error.tsx`

Every protected segment needs both (Golden Rule #23b). Chain into the `webapp-error-boundaries` skill if you need the templates.

Minimum:
- `apps/webapp/src/app/(protected)/{route}/loading.tsx` — skeletons that **shape-match** the real layout (e.g. 4 `<Skeleton>` cards for the stats row + skeleton rows for the list)
- `apps/webapp/src/app/(protected)/{route}/error.tsx` — Client Component rendering `<SegmentError>` from `@/components/layout/segment-error`

---

## Phase 7 — Sidebar wiring

If the screen should appear in the sidebar (default yes):
- Edit [apps/webapp/src/components/layout/sidebar.tsx](apps/webapp/src/components/layout/sidebar.tsx)
- Add a `NavLink` entry following the existing pattern (icon + label + href)
- Pick an icon from the icon set already used in the file

---

## Phase 8 — Verify

1. `Bash` on every changed file
2. `pnpm nx build webapp`
3. Start the webapp (`Service: Serve webapp` task) and visit the route
4. Run `mcp__figma2__get_screenshot` again on the original Figma frame and compare side-by-side
5. **Run a11y check:** add the new route to `apps/webapp-e2e/src/specs/a11y/axe-scan.spec.ts` per the `fe-accessibility-audit` skill
6. **Test dark mode:** toggle the theme and verify nothing breaks (every visual element should flip via semantic tokens — if anything stays the same colour, you have a hard-coded hex somewhere)

---

## Phase 9 — Commit-ready checklist

- [ ] All primitives used by the page exist in `@mma/ui` (no inline `<button>`, `<input>`, `<table>`)
- [ ] All data fetching goes through `@mma/client-common` hooks (no `fetch` in page or component files)
- [ ] Page is a thin orchestrator (no table/form markup inline)
- [ ] `loading.tsx` + `error.tsx` exist for the segment
- [ ] Sidebar nav entry added (if user-facing)
- [ ] No hex literals, no `text-[Npx]`, no `rounded-[Npx]`, no `data-node-id`
- [ ] Dark mode verified
- [ ] axe scan passes (no critical/serious violations)
- [ ] `pnpm nx build webapp` passes

---

## Worked example skeleton — Time Tracker Dashboard

Phase 2 output for an example time-tracker Dashboard would look like this:

```markdown
### Screen: Time Tracker — Dashboard

Sections (top to bottom):
1. Stats row — 4 KPI cards (Today, Week, Active projects, Billable %)
2. Active timer panel — current task + elapsed time + start/stop button
3. Recent entries — list of last N tracked entries (project, task, duration, time-of-day)
4. Today's projects — chips/pills showing which projects had time today

Primitives needed:
| Primitive | Status | Source |
|---|---|---|
| Card, CardHeader, CardTitle, CardContent | ✅ exists | @mma/ui |
| Button | ✅ exists | @mma/ui |
| Badge | ✅ exists | @mma/ui |
| Input | ✅ exists | @mma/ui |
| Skeleton | ✅ exists | @mma/ui |
| StatCard | ❌ NEW | build via figma-to-ui-component |
| TimerDisplay | ❌ NEW | build via figma-to-ui-component (HH:MM:SS monospace + variants) |

Domain components (apps/webapp/src/components/timer/):
- ActiveTimerPanel — uses StatCard + TimerDisplay + Button + useActiveTimer/useStartTimer/useStopTimer
- RecentEntriesList — uses Card + Badge + entry data
- TodayProjectChips — uses Badge + project list

Hooks needed (none yet exist):
- useTodayStats() — GET /api/timer/stats/today
- useActiveTimer() — GET /api/timer/active
- useStartTimer() — POST /api/timer/start
- useStopTimer() — POST /api/timer/stop
- useRecentEntries({ limit }) — GET /api/timer/entries?limit=N
- useTodayProjects() — GET /api/timer/projects/today

Backend not yet built — would also require timer-domain package + timer-api-service.
```

This output, presented to the user as the FIRST response after Phase 1, is the most valuable thing this skill produces. It turns "build me a dashboard" into "here are 14 concrete tasks in dependency order, do you agree?" — which is exactly the conversation we want.

---

## Anti-patterns (auto-reject)

- Writing a 500-line `page.tsx` with all sections inline.
- Inline `fetch()` in the page file.
- Raw `<button>`, `<input>`, `<table>` in the page or domain components.
- Using `<Card>` to wrap everything just because Figma shows a panel — Card is for genuinely card-shaped surfaces, not for "a section that needs padding".
- Adding domain-specific components to `@mma/ui` (`UserListRow`, `OrderStatusPill` — these go in `apps/webapp/src/components/{domain}/`).
- Adding screen-generic components to `apps/webapp/src/components/{domain}/` (`StatCard`, `KpiNumber` — these go in `@mma/ui`).
- Skipping Phase 2 (decomposition) and going straight to coding.
- Skipping Phase 3 (build missing primitives first) — leads to inline soup.
- Forgetting `loading.tsx` / `error.tsx`.
- Hex literals or `text-[Npx]` anywhere — same rule as `figma-to-ui-component`.
