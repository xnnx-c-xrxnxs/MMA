# ADR-006: Figma import requires per-primitive visual + type gates inside Phase B

**Status:** ACCEPTED
**Date:** 2026-05

## Context

The `/figma-import` orchestrator (`.claude/commands/figma-import.md`) shipped
a Phase B that ended with a single block of static checks after primitives were
generated — `pnpm nx run-many -t lint,build,test --projects=ui,mobile-ui` plus
`pnpm nx run ui:build-storybook` — and pushed the only visual ground-truth check
(Gate 3: scroll `/design-preview` next to per-section PNGs) all the way to the
end of the workflow, after pages had already consumed the primitives.

A real run against an external Figma file (25 user messages / 101 assistant
turns, 13 distinct back-and-forth correction rounds, summarised in
`tmp/figma-import-session-summary.md`) exposed four failure classes the
workflow declared "successful" because the existing gates passed:

1. **Visual drift on 8 of the imported primitives** (list-row, input-disabled
   variant, empty-state, avatar, badge tone, nav-item, skeleton corner radius,
   card padding) — caught only after the developer scrolled `/design-preview`
   in Gate 3, by which time the same primitives were already wired into pages.
2. **Icon hallucination** — a `ClockIcon` was added to `empty-state` even
   though the Figma frame had no clock anywhere. The `fe-icon-set` skill was
   permissive enough to accept "looks like it would fit thematically".
3. **Story authoring went loose under time pressure** — `ListRow.selected`
   was wired as a className, not an `args:` value, so the Storybook control
   in the addon panel did nothing. `Skeleton` Show Code panel surfaced raw
   `className` strings instead of `args`. `Card` lost its `variant` argType
   altogether. None of this is rejected by `lint` or `build`.
4. **Type drift between B.2 and B.2.5** — primitive regeneration renamed
   `EmptyStateAction` props, but the broken reference only surfaced when
   Gate 2 ran, far after the regenerated primitive was committed.

The structural lint suite (`scripts/lint-standards.ts`) covers naming and
file-shape rules but does not know anything about Figma provenance or
Storybook authoring. The runtime parity gate (Gate 0) asserts that
`/design-preview` renders the right NUMBER of cells per section but does
not inspect any individual cell.

## Decision

Restructure the verification surface so primitive correctness is verified
**inline with primitive generation**, not at the end of Phase B:

1. **New B.2.4 — Type checkpoint** runs `pnpm nx run-many -t build --projects=ui,mobile-ui`
   immediately after the primitive batch. RED here blocks B.2.5.
2. **New B.2.6 — Per-primitive visual checkpoint** boots Storybook, lists every
   primitive that was just generated or replaced with its Storybook docs URL
   side-by-side with `apps/webapp/src/app/design-preview/figma-references/{name}.png`,
   and STOPS for a single bulk approval. Regenerate / loop until all primitives
   pass. The existing Gate 3 stays as a regression check against the composed
   `/design-preview` page.
3. **A.4.5 also enumerates icons** as `manifest.icons[]` — each entry
   `{ name, figmaNodeId, svgSource? }`. A.5 Section 2 embeds a thumbnail link
   to each per-primitive PNG so the developer can sanity-check the source
   frame before approving.
4. **`fe-icon-set` skill adds a provenance rule** — when an icon is added
   during a Figma workflow, it must trace to an entry in `manifest.icons[]`
   or to the pre-Figma template allowlist recorded in the manifest itself.
5. **`webapp-ui-primitive` skill adds a Stories contract** — every cva
   variant key must appear as a Storybook `argTypes` entry; non-default
   variant values are set via `args:` (so the addon controls work), not via
   className strings.
6. **Two structural lint checks** enforce 4 and 5:
   - `figma-imported-icons-have-manifest-entry`
   - `cva-variants-have-storybook-argtypes`
7. **Three new safety guards** (#17–#19) make the new behaviour explicit:
   #17 no agent-invented icons, #18 B.2.6 is mandatory before primitives
   reach consumers, #19 stories ship working argType panels.

## Rationale

The existing gates are necessary but insufficient: Gate 2 catches TypeScript
breakage, Gate 0 catches missing cells, Gate 3 catches everything else — but
Gate 3 runs last, and "everything else" includes any visual drift on any of
the N primitives generated. Pushing visual sign-off earlier and per-primitive
turns the linear N×K back-and-forth into a single bulk review per batch.

Embedding per-primitive PNG thumbnails in the approval doc (Section 2) means
the developer is shown the source frame they are approving — the original
workflow asked them to approve a name + an action without seeing the Figma
cell. That asymmetry is the structural reason every visual drift survived
approval.

Making icon provenance explicit closes the most embarrassing failure: the
agent picked up a thematically-plausible icon from `lucide-react`-style
naming and added it to a primitive even though it was nowhere in the Figma
file. A manifest entry costs the agent one line in A.4.5 and gives the lint
check a deterministic check.

The Stories contract codifies behaviour that experienced engineers do
already but that the agent drifted away from under length pressure. The
lint check fails the build the moment a primitive ships a `variant`
prop without a matching argType — catching the failure at the time it is
introduced, not in code review.

## Alternatives Rejected

- **Run all five gates after every primitive** — would 5× the verification
  time on a 20-primitive import and burn through Storybook startup cost
  per primitive. Bulking the visual review per BATCH is the correct grain.
- **Visual diff per primitive via Playwright `toHaveScreenshot()`** —
  considered, but a Storybook-vs-PNG comparison is brittle (font hinting,
  scrollbar widths) and the human eye is still the gold standard for
  "does this match Figma". Gate 4 keeps automated visual regression for
  the composed `/design-preview` page, where the baseline is stable.
- **Auto-fail Phase B on any primitive without a stories file** —
  already enforced by `ui-primitive-has-story-and-spec`; the new contract
  layers behavioural assertions on top.
- **Make B.2.6 optional / "smoke-only"** — that is what the previous
  workflow effectively did (Gate 3 at the very end). The 13-round
  back-and-forth proves the cost of skipping it.

## Constraints

- `figma-library-manifest.json` MUST contain an `icons[]` array (possibly
  empty) and an `iconsTraceabilityEnforced: true` sentinel after A.4.5
  completes. The lint check is a no-op until both are present.
- Every primitive listed as REPLACE or GENERATE NEW in the approved plan
  Section 2 MUST appear in the B.2.6 checklist with a Storybook URL.
- Safety guard #18 makes B.2.6 non-skippable; the agent cannot proceed to
  B.3 (hooks) until the developer types `all ok`.
- The Stories contract applies only to `packages/ui/src/components/**` —
  it intentionally does not apply to `apps/webapp/src/components/{domain}`
  (page-local components do not ship Storybook docs).
- The icon traceability lint check reads from the manifest in
  `apps/webapp/src/app/design-preview/figma-library-manifest.json`. If
  that file is removed (project never adopted `/figma-import`), the check
  is a no-op.
