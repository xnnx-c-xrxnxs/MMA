# @old-st/mobile-ui Package Context

This file loads automatically for any file inside `packages/mobile-ui/`. The package is the **single source of truth for mobile (React Native / Expo) UI primitives** — the mobile counterpart of `@old-st/ui`.

---

## What This Package Provides

| Subpath | Purpose |
|---|---|
| `src/components/` | React Native primitives (Badge, Button, Card, Text, Input, Separator, ErrorBoundary, etc.). One file per component, plus a barrel `index.ts`. |
| `src/lib/theme.ts` | Mobile-side design tokens. Re-exports `lightColors` / `darkColors` from `@old-st/ui/tokens` to keep web + mobile in sync. Adds `spacing`, `radii`, `fontSizes` shaped for `StyleSheet.create()`. |

---

## Architectural Rules (Strictly Enforced)

1. **No domain logic.** Primitives never import from `@old-st/contracts/*`, `@old-st/client-common`, or any domain package.

2. **Use the `variant record` pattern for variants.** Map `variant` prop → style object via a typed record (e.g. `const variantStyles: Record<BadgeVariant, ViewStyle> = { ... }`). See `mobile-ui-primitive` skill.

3. **All styles via `StyleSheet.create()`** at the bottom of the file (Golden Rule #34). Never inline style objects except for one-off dynamic values.

4. **Tokens come from `theme.ts`, NEVER hard-coded colors.** All color values must originate in `@old-st/ui/tokens` and be re-exported through `theme.ts` so web + mobile stay in lockstep (Golden Rule #23j).

5. **Use `forwardRef`** when wrapping a native React Native element so consumers can attach refs. (Note: React Native’s `forwardRef` deprecation follows React’s timeline — once the RN version used by Expo fully supports ref-as-prop, migrate to the direct pattern.)

6. **Barrel export.** Every new primitive must be re-exported from `packages/mobile-ui/src/index.ts`.

7. **Test with `@testing-library/react-native`** — see `write-mobile-tests` skill.

---

## Skills That Govern This Package

| Task | Skill |
|---|---|
| Adding a new primitive | `mobile-ui-primitive` |
| Adding/changing design tokens | `fe-design-tokens` |
| Per-screen error boundaries | `mobile-error-boundary-sentry` |
| Writing component tests | `write-mobile-tests` |

**Always read the relevant skill BEFORE editing this package.**

---

## Cross-Platform Coordination

When adding a primitive that already exists in `@old-st/ui`, mirror the prop API exactly so consumer code reads the same way on both platforms. Use the `/new-ui-primitive` workflow prompt to scaffold both packages together.
