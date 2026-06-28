# ADR-002: design-preview Surface Stays in Main Workspace

**Status:** ACCEPTED  
**Date:** 2026-05

## Context

`apps/webapp/src/app/design-preview/` is a runtime viewer for the Figma design system library. It is populated by the `figma-import` workflow prompt and contains a `figma-library-manifest.json` plus reference PNGs. Because it contains snapshot data, there was a question of whether it belongs in `examples/` alongside other example-specific content.

## Decision

The `design-preview` directory stays in the main workspace at `apps/webapp/src/app/design-preview/`. The **data** at that path (manifest, reference PNGs) is reset to a clean placeholder when initialising a new project.

## Rationale

The `figma-import` workflow command (`.claude/commands/figma-import.md`) writes to this exact path in Phase B.2.5 and reads from it in Gates 0, 3, and 4. The `Q9 preview-only` re-run mode requires the directory to pre-exist. Moving it to `examples/` would break the Figma import workflow for every new project that clones this template.

The manifest content is not example-domain data — it is a snapshot of whatever design system the current project has imported. It gets overwritten on first import run, so shipping a clean placeholder is correct.

## Alternatives Rejected

- **Move entire directory to `examples/`:** Breaks the `figma-import` workflow for all new projects — the workflow writes to a hardcoded path.
- **Duplicate in both locations:** Creates two sources of truth; the workflow would need to know which copy to write to.

## Constraints

- `figma-library-manifest.json` must be reset to `[]` when initialising a new project via `init-project.mjs`
- `_library.tsx` stub must handle an empty manifest without crashing
- The `RENDERERS` registry pattern in `_library.tsx` must be preserved empty so `figma-import` can populate it on first run
- Visual regression baselines under `apps/webapp-e2e/src/specs/visual/design-preview.spec.ts-snapshots/` must be deleted on project init (stale baselines fail Gate 4 immediately)
