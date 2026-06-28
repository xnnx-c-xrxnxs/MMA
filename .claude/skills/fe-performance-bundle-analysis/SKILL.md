---
name: fe-performance-bundle-analysis
description: Analyze and optimize webapp bundle size and performance. Use when investigating a bundle-size regression, auditing dependencies before adding a package, finding code-split opportunities, or diagnosing slow Time-To-Interactive.
---

# fe-performance-bundle-analysis

## When to use

- Investigating a regression in webapp bundle size
- Auditing dependencies before adding a new package
- Identifying split-point opportunities (`next/dynamic`, route-level chunks)
- Diagnosing slow Time-To-Interactive on a specific page

## Bundle analyzer

The webapp ships `@next/bundle-analyzer` gated by the `ANALYZE` env var.

```bash
ANALYZE=true pnpm nx run webapp:build
```

Output: `apps/webapp/.next/analyze/` (open `client.html`, `nodejs.html`, `edge.html` in a browser).

The analyzer is a no-op when `ANALYZE` is not `'true'`, so day-to-day builds are unaffected.

## What to look for

| Signal | Likely cause | Fix |
|---|---|---|
| A route chunk > 200 KB gzip | A heavy library imported at module top-level | Convert to `next/dynamic` with `ssr: false` if not needed for SSR |
| The same library appearing in multiple route chunks | Library imported in shared component without code-split | Move to a single shared chunk via `next/dynamic` or refactor the component to be loaded on demand |
| `node_modules/<package>` dominates the framework chunk | Heavy dep pulled in by `Providers` or `layout.tsx` | Lazy-load via dynamic import, or replace with lighter alternative |
| Tree-shaking is failing | CommonJS-only package or `import * as` patterns | Switch to ESM build of the dep, or import named exports only |

## Page-level performance

Beyond bundle size, the practical levers in this codebase:

1. **`next/image` for any non-trivial image** — automatic resizing, lazy loading, and modern format negotiation.
2. **Server Components by default** — only mark a file `'use client'` when it actually needs hooks/state/event handlers. Domain tables and forms are client; layout shells are server.
3. **React Query `staleTime`** — set sensible staleness on hooks that don't need second-by-second freshness.
4. **Suspense + `loading.tsx`** — every protected route segment already has a `loading.tsx` (Golden Rule 23b); use `<TableSkeleton>` rather than spinners.
5. **`<DataTable>` virtualization** — for very long lists, prefer cursor-based infinite scroll (see [webapp-cursor-infinite-scroll](../webapp-cursor-infinite-scroll/SKILL.md)).

## Mobile performance

For Expo:

- Hermes is enabled by default (Expo SDK 54+) — no action needed.
- Use `FlatList` over `ScrollView + map()` for any list with > ~20 items (Golden Rule 30 / 32).
- For large screens, use `React.memo` on row components when re-renders are expensive.
- EAS Update `runtimeVersion: 'appVersion'` keeps OTA updates small (only JS, not native).

## Rules

1. **Never add a > 50 KB dependency without first running `ANALYZE=true`** and confirming the post-build delta.
2. **`'use client'` is opt-in.** New leaf components default to Server Components unless they need state or events.
3. **Prefer `next/dynamic` over module-level import** for libraries used only on a single route or below the fold.
4. **Don't fight the analyzer** — if a chunk balloons unexpectedly, fix the import graph rather than configuring webpack to hide it.

## Verification

```bash
ANALYZE=true pnpm nx run webapp:build
# Open apps/webapp/.next/analyze/client.html
```

Compare against the previous run before merging. Targets:

- Total client JS (gzip): < 250 KB for first load
- Per-route chunk (gzip): < 80 KB
- Largest dependency: < 80 KB (excluding React + framework)
