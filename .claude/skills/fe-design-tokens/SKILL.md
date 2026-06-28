---
name: fe-design-tokens
description: Add, change, or audit cross-platform design tokens (colors, spacing, radii, typography). Use this when introducing a new color, semantic alias, scale step, or when the webapp/mobile theme drifts from the Figma source.
---

# Design tokens — single source of truth

## When to use

- Adding a new color, spacing step, radius, or typography size
- Changing an existing token VALUE (same name, new hex) — propagates automatically, no consumer edits
- RENAMING a token (e.g. `Btn` → `Button`) — requires a consumer-site rewrite across the codebase
- REMOVING a token — requires a consumer audit and a delete/rebind/orphan decision per consumer
- Adding a new platform that needs to consume the design system
- Auditing for drift between `tokens.ts` and `globals.css`

> For BULK changes driven by a Figma re-extract (10+ tokens at once, especially when Figma renames or removes things), use the `/figma-import` orchestrator prompt instead — it produces a Section 8 approval doc with a full consumer audit and applies all changes atomically. This skill covers ad-hoc single-token edits.

## The single source of truth

```
packages/design-tokens/src/lib/tokens.ts
```

Everything cross-platform comes from here. The file exports:

| Export | Tier | What it is |
|---|---|---|
| `lightColors`, `darkColors` | Tier 1 + 2 | Numeric scales (50..950) for brand · gray · success · warning · danger AND semantic aliases (primary, muted, brand, destructive, …) |
| `spacing` | — | Numeric pixel values (xs..xxl) |
| `radii` | — | Numeric pixel values (sm..full) |
| `fontSizes` | — | Numeric pixel values (xs..xxl) |
| `fontFamilies` | — | CSS font-family stacks (`sans`, `mono`) — first entry is a `var(--font-…)` placeholder so `next/font` can inject the loaded font face on web; subsequent entries are the system fallback chain |
| `tokens` | — | Convenience bundle of all of the above |
| `ColorTokens` | — | Type of one color palette |

### Two-tier color model

```
Tier 1 — NUMERIC SCALES (brand50..brand950, gray50..gray950, …)
   Raw palette. Use directly when a specific shade is the design intent
   (e.g. `bg-brand-100` for a tinted info panel).

Tier 2 — SEMANTIC ALIASES (primary, muted, destructive, brand, brand-subtle …)
   Map onto a specific scale step per theme. Use these in 95% of cases —
   they auto-adapt to dark mode and keep components portable.
```

```tsx
//  ❌  bg-[#7f56d9]              raw hex — forbidden
//  ⚠️  bg-brand-600              scale step — OK when shade matters
//  ✅  bg-primary                semantic — preferred default
```

## How each platform consumes tokens

### Web (Tailwind v4)

`apps/webapp/src/app/globals.css` exposes the palette as CSS variables under `@theme { … }` (light) and `.dark { … }` (dark overrides). **Both blocks are GENERATED from `tokens.ts`** — do not hand-edit them. The script:

```
scripts/generate-css-tokens.mjs   # node, no deps
```

Sentinels in `globals.css`:

```css
/* AUTO-GENERATED:tokens START — do not edit by hand. Run `pnpm tokens:gen`. */
@theme { … }
.dark   { … }
/* AUTO-GENERATED:tokens END */
```

Mapping rules the script applies:

- camelCase → kebab-case: `cardForeground` → `--color-card-foreground`
- numeric scales: `brand600` → `--color-brand-600`
- `radii` → `--radius-{key}` (px → rem)
- `fontFamilies` → `--font-{key}` (e.g. `--font-sans`, `--font-mono`)

Utility classes resolve through the variable:

```tsx
<div className="bg-card text-card-foreground" />
//             ↳ var(--color-card)  ↳ var(--color-card-foreground)
```

### Fonts on web (next/font wiring)

The `fontFamilies.sans` value is `'var(--font-sans), ui-sans-serif, system-ui, …'`. The CSS variable `--font-sans` is **set by `next/font`** in `apps/webapp/src/app/layout.tsx`:

```tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

How the cascade resolves:

1. `next/font` self-hosts Inter and emits `--font-sans: 'Inter Fallback', …` on `<html>`.
2. Tailwind's `font-sans` utility expands to `font-family: var(--font-sans, ui-sans-serif, system-ui, …)` from the `@theme` block.
3. The browser picks Inter when present, then walks the fallback chain.

Storybook, RSC payloads outside the layout, and any place without `next/font` get a clean system-stack fallback for free — no FOUT, no broken layouts.

**To swap or add a font** (e.g. add a heading display face):

1. Pick the font in `apps/webapp/src/app/layout.tsx` and assign it a CSS variable:
   ```tsx
   const display = Geist({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
   <html className={`${inter.variable} ${display.variable}`}>
   ```
2. Add a matching entry to `fontFamilies` in `tokens.ts`:
   ```ts
   display: 'var(--font-display), ui-sans-serif, system-ui, …'
   ```
3. `pnpm tokens:gen` — emits `--font-display` in the `@theme` block; `font-display` utility class becomes available.
4. Use `<h1 className="font-display">…` in components.

### Mobile (React Native)

`@mma/mobile-ui` re-exports `lightColors`, `darkColors`, `spacing`, `radii`, `fontSizes` from `@mma/ui` so mobile primitives consume the exact same token names. Switch palette via `useColorScheme()`:

```tsx
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from '@mma/mobile-ui';

const palette = useColorScheme() === 'dark' ? darkColors : lightColors;
```

The legacy `colors` export is an alias for `lightColors` (back-compat).

## Workflow — adding a token

```
 1. edit  packages/design-tokens/src/lib/tokens.ts
          • add to BOTH lightColors AND darkColors
          • prefer adding a semantic alias, not a one-off scale step
 2. run   pnpm tokens:gen
 3. use   <div className="bg-mynewthing" />          ← web
          backgroundColor: palette.myNewThing        ← mobile
 4. test  pnpm nx run-many -t test --projects=ui,mobile-ui
 5. open  http://localhost:4200/design-preview/colors
          (only if your project has scaffolded /design-preview — see
           figma-import.md Phase B.6.5; the template repo does not
           ship this surface)
```

## Workflow — changing a token VALUE (same name, new hex)

The most common case. Components reference tokens by NAME (`bg-primary`, `bg-brand-600`), so the new value propagates everywhere via the regenerated `tokens.css` with **zero consumer edits**.

```
 1. edit  packages/design-tokens/src/lib/tokens.ts
          • update the value in BOTH lightColors AND darkColors
          • keep the key identical (brand600 → brand600)
 2. run   pnpm tokens:gen
 3. test  pnpm nx run-many -t lint,build,test --projects=ui,mobile-ui,webapp
 4. open  http://localhost:4200/design-preview
          eyeball the colored swatches; every existing component picks up
          the new hex automatically
```

Do NOT grep the codebase for the old hex value — components don't reference hexes, only names. Skip the consumer-rewrite step entirely.

## Workflow — RENAMING a token (`oldName` → `newName`)

Destructive. Every consumer site must be rewritten in the same commit or the build breaks.

```
 1. audit  grep -r 'oldName' packages apps                      ← list every consumer
           # also grep for the kebab form in CSS:
           grep -r 'var(--color-old-name)' packages apps
           # confirm the full impact BEFORE editing tokens.ts
 2. edit   packages/ui/src/lib/tokens.ts
           • rename the key in BOTH lightColors AND darkColors
 3. rewrite every consumer file found in step 1:
             *.tsx / *.ts  →  bg-oldName        → bg-newName
                              text-oldName      → text-newName
                              border-oldName    → border-newName
                              ring-oldName      → ring-newName
                              tokens.oldName    → tokens.newName
                              lightColors.oldName / darkColors.oldName → newName
             *.css         →  var(--color-old-name) → var(--color-new-name)
 4. run    pnpm tokens:gen
 5. test   pnpm nx run-many -t lint,build,test --projects=ui,mobile-ui,client-common,webapp
           # a TS / lint error here means the audit in step 1 missed a site — grep harder
```

Commit the token rename + every consumer rewrite **together**. A split commit leaves the codebase in a broken intermediate state.

## Workflow — REMOVING a token

Destructive. Pick the strategy per consumer before editing.

```
 1. audit  grep -r 'tokenName' packages apps
           grep -r 'var(--color-token-name)' packages apps
           # for every consumer found, decide one of:
           #   (a) delete the consuming line/element
           #   (b) rebind to a different existing token
           #   (c) keep the token as a code-only orphan with a comment
 2. for (a) delete:  remove the consuming lines, verify the surface still makes sense
    for (b) rebind:  do a token RENAME (workflow above) pointing every consumer at the target token
    for (c) orphan:  leave the tokens.ts entry, prepend a
                     `// kept after Figma removal on YYYY-MM-DD` comment,
                     do not touch consumers
 3. only when EVERY consumer has been handled, remove the key from tokens.ts
 4. run    pnpm tokens:gen
 5. test   pnpm nx run-many -t lint,build,test --projects=ui,mobile-ui,client-common,webapp
```

Never remove a token from `tokens.ts` while consumers still reference it — TypeScript will not catch every Tailwind utility usage (`bg-{name}` is a string literal at runtime), so the build can pass green while components render unstyled.

## CI drift check

`pnpm tokens:check` runs the generator and fails if `git diff --exit-code apps/webapp/src/app/globals.css` is non-empty. This is wired into `ci-fast-check.yml` so a PR cannot merge with stale CSS.

## Hard rules

1. **Never hard-code colors, spacing, or radii in components.** Use semantic Tailwind utilities on web and theme-token imports on mobile.
2. **Light and dark MUST stay in sync.** Adding a key to one without the other is a violation — the script will throw a runtime KeyError when the key is missing in `darkColors`.
3. **Mobile and web semantic names MUST match.** If you add `infoBg` to web tokens, mobile gets it for free via the re-export.
4. **Never hand-edit the AUTO-GENERATED block in `globals.css`.** Re-run `pnpm tokens:gen` instead.
5. **Every workspace package whose components use `cva()` MUST have an `@source` directive in `globals.css`.** Tailwind v4 only auto-scans `apps/webapp/src/`. Workspace packages are excluded by default, so utility classes inside cva strings are silently dropped — components render as **0×0 boxes**. Already wired:
   ```css
   @source "../../../../packages/ui/src";
   ```
6. **No SCSS / Sass / styled-components / Emotion anywhere.** Enforced by the `no-scss-files` structural lint check (`scripts/lint-standards.ts`). Tailwind utilities + cva is the only styling system.

## Verification

```powershell
pnpm tokens:gen                                          # regenerate CSS
pnpm tokens:check                                        # CI drift check
pnpm nx run-many -t test --projects=ui,mobile-ui
pnpm nx run webapp:dev
# then open http://localhost:4200/design-preview (only if scaffolded —
# the template repo does not ship this surface; see figma-import.md
# Phase B.6.5 to scaffold it on first Figma import)
```

The design preview renders Colors / Typography / Grid / Icons / Components against the live tokens. Use `<ThemeToggle>` in the page header to flip dark/light — never wrap subtrees in a `.light` className. The `.light` mirror block was removed in favor of the runtime `<html class="dark">` toggle from `next-themes`.

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Primitive renders as 0×0 in browser | Missing `@source` directive | Add `@source` line for the package |
| `pnpm tokens:check` fails on CI | Edited `tokens.ts` without running `pnpm tokens:gen` | Run it locally and commit the diff |
| Dark mode shows light values | New token added to `lightColors` only | Add the same key to `darkColors` and re-run `pnpm tokens:gen` |
| Webapp `bg-{name}` resolves to nothing | New semantic alias added but `globals.css` not regenerated | `pnpm tokens:gen` |
