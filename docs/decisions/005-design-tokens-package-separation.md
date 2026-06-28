# ADR-005: Design Tokens Package Separation from @old-st/ui

**Status:** ACCEPTED  
**Date:** 2026-05

## Context

All design tokens (colors, spacing, radii, typography) previously lived in
`packages/ui/src/lib/tokens.ts` and were re-exported from `@old-st/ui`. This
created two problems:

1. **Coupling:** `@old-st/mobile-ui` imported token JS values from `@old-st/ui`
   — a web-component library — creating an awkward dependency where a React
   Native package depended on a React DOM package.

2. **Theme-swapping is impossible:** Replacing the token set (e.g. white-label
   branding) would require changing `@old-st/ui`'s public API, re-releasing the
   UI package, and updating all consumers — even though zero component logic
   changed.

The Tailwind v4 `@theme` model already decouples token _values_ from component
_usage_: `@old-st/ui` components reference semantic utilities (`bg-primary`,
`text-foreground`) that resolve against CSS custom properties at runtime. The
components have no runtime dependency on token values — only on the CSS
variables being present in the document.

## Decision

Design tokens are extracted into a standalone `@old-st/design-tokens` package
(`packages/design-tokens/`).

- **`@old-st/design-tokens`** owns `tokens.ts` (JS values) and `tokens.css`
  (generated CSS custom properties). It has no dependency on any other
  workspace package.

- **`@old-st/ui`** carries zero JS-level dependency on `@old-st/design-tokens`.
  Its components consume tokens exclusively via Tailwind CSS utilities that
  resolve against CSS custom properties. The `tokens.ts` and `tokens.css` files
  are removed from `packages/ui/`.

- **The webapp** feeds tokens to `@old-st/ui` by `@import`-ing
  `tokens.css` from `@old-st/design-tokens` inside `globals.css`. This is the
  only coupling point between the token package and the web UI layer.

- **`@old-st/mobile-ui`** imports JS token values directly from
  `@old-st/design-tokens` (not from `@old-st/ui`).

## Rationale

- **Theme swapping:** To switch brand tokens, replace the `tokens.css` import
  in `globals.css`. Zero `@old-st/ui` changes needed.

- **Clean dependency direction:** `@old-st/ui` no longer knows where tokens
  come from. The app controls the token supply.

- **Eliminates cross-ecosystem coupling:** `@old-st/mobile-ui` no longer
  depends on a web component library.

- **Aligns with Tailwind v4's CSS variable model:** which already treats token
  values as a runtime concern resolved by CSS, not a compile-time dependency.

## Alternatives Rejected

- **Re-export tokens from `@old-st/ui` (keep the status quo):** Retained the
  coupling. Prevented theme swapping without UI package changes.

- **Import JS tokens directly in `@old-st/ui` components for feature parity:**
  Would add a JS-level import from `@old-st/design-tokens` to `@old-st/ui`,
  breaking the clean boundary. `@old-st/ui` must never import from
  `@old-st/design-tokens`.

## Constraints

- `@old-st/ui`'s `package.json` must **never** list `@old-st/design-tokens` as
  a dependency.
- `@old-st/ui` source files must **never** `import` from `@old-st/design-tokens`.
- CSS custom properties are the only coupling point between `@old-st/design-tokens`
  and `@old-st/ui`.
- `pnpm tokens:gen` regenerates `packages/design-tokens/src/lib/tokens.css` from
  `packages/design-tokens/src/lib/tokens.ts`. CI (`ci-fast-check.yml`) fails on
  drift.
