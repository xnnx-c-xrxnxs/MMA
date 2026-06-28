---
name: webapp-dark-mode
description: Wire or modify dark-mode support in the Next.js webapp. Use when adding a theme-aware color or top-level provider, or diagnosing a flash-of-unstyled-content (FOUC).
---

# webapp-dark-mode

## When to use

- Wiring or modifying dark-mode support in the Next.js webapp
- Adding a new color that must theme correctly in both modes
- Adding a new top-level provider that interacts with theming
- Diagnosing a flash-of-unstyled-content (FOUC) on initial render

## Architecture

Dark mode is implemented via:

1. **CSS variables** — `apps/webapp/src/app/globals.css` defines tokens once for light (`@theme`) and once for dark (`.dark { ... }`).
2. **Tailwind v4 `@custom-variant dark`** — declared at the top of `globals.css` so utility classes like `dark:bg-card` work without per-file config.
3. **`next-themes` `ThemeProvider`** — wraps the entire app in `apps/webapp/src/components/theme-provider.tsx`. It writes `class="dark"` on `<html>` based on the user's choice and the OS preference.
4. **`<ThemeToggle>`** — three-state button (light → dark → system) mounted in the Header.

## Required pieces

| File | Role |
|---|---|
| `apps/webapp/src/app/globals.css` | Defines `--color-*` variables for light + `.dark` block + `@custom-variant dark` |
| `apps/webapp/src/components/theme-provider.tsx` | Re-exports `next-themes` with `attribute="class"`, `enableSystem`, `disableTransitionOnChange` |
| `apps/webapp/src/components/theme-toggle.tsx` | Three-state toggle, uses `mounted` flag to avoid hydration mismatch |
| `apps/webapp/src/app/layout.tsx` | Wraps `<Providers>` in `<ThemeProvider>`; `<html className={inter.variable} suppressHydrationWarning>` — `suppressHydrationWarning` is required by `next-themes` (it mutates the class on the client); `inter.variable` is set by `next/font` to inject the `--font-sans` CSS variable. Both attributes coexist on `<html>`. |

## Rules

1. **Always wrap `next-themes` access in a `mounted` guard.** Reading `theme` on the server and rendering its value causes hydration mismatches. The `<ThemeToggle>` component shows the canonical pattern.
2. **`<html>` MUST have `suppressHydrationWarning`** when using `next-themes` with `attribute="class"`. If the webapp also uses `next/font`, include both attributes: `<html className={inter.variable} suppressHydrationWarning>`. `next-themes` sets `class="dark"` at runtime; `inter.variable` adds the font CSS variable — neither conflicts.
3. **New colors MUST be added to both `@theme` and `.dark` blocks in `globals.css`.** A token that exists in only one block silently breaks when the user toggles.
4. **Never gate theme tokens behind JS conditionals (`isDark ? '#fff' : '#000'`)** — write Tailwind utility classes (`bg-background text-foreground`) so the CSS variable system handles it.
5. **Components in `@old-st/ui` MUST use semantic utility classes** (`bg-card`, `text-muted-foreground`) — never hard-coded colors. This is the primitive's responsibility, not the consumer's.

## Adding a new themed surface

1. Pick the closest semantic name (`background`, `card`, `popover`, `muted`, `accent`, `destructive`).
2. If none fit, add a new token following the [fe-design-tokens skill](../fe-design-tokens/SKILL.md).
3. Use the utility class — never inline color.

## Verification

```bash
pnpm nx test webapp
pnpm nx build webapp
```

Manual:

1. `pnpm nx serve webapp`
2. Click the Header toggle through light → dark → system
3. Confirm no flash, no leftover light styles, no scrollbars or borders that don't re-theme
