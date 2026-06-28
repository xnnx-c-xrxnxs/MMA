---
name: fe-accessibility-audit
description: Run an accessibility pass on the webapp. Use when adding a new page route or shared UI primitive, before a release, or investigating keyboard-navigation / screen-reader issues.
---

# fe-accessibility-audit

## When to use

- Adding a new top-level page route to the webapp
- Adding a new shared UI primitive
- Doing a periodic accessibility pass before release
- Investigating a reported keyboard-navigation or screen-reader issue

## Tooling

The webapp E2E project ships `@axe-core/playwright`. The canonical scan suite lives at:

```
apps/webapp-e2e/src/specs/a11y/axe-scan.spec.ts
```

It iterates over a list of routes (`PAGES_TO_SCAN`) and asserts that each page has zero `critical` or `serious` violations against `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa`.

`minor` and `moderate` issues print to the test console but do not fail the suite — bring those down opportunistically.

## How to add a page to the scan

1. Open `apps/webapp-e2e/src/specs/a11y/axe-scan.spec.ts`.
2. Add an entry to `PAGES_TO_SCAN`:
   ```ts
   { path: '/your-new-page', name: 'your-new-page' }
   ```
3. Run only the a11y suite:
   ```bash
   pnpm nx e2e webapp-e2e -- --grep "@a11y"
   ```

## How to fix a violation

When axe reports a violation, the output includes:

- `id` — the rule (e.g. `color-contrast`, `button-name`, `label`)
- `impact` — `critical` / `serious` / `moderate` / `minor`
- `nodes` — the failing element selectors
- `helpUrl` — link to a fix guide

Common fixes in this codebase:

- **`button-name`** — add `aria-label` to icon-only buttons (`<Button size="icon">`).
- **`label`** — wire `<Input>` to a `<Label htmlFor>` or wrap in `<FormField>` from `@old-st/ui`.
- **`color-contrast`** — adjust the token in `packages/ui/src/lib/tokens.ts` and mirror to `globals.css`. **Do not** hard-code a workaround color in the offending component.
- **`landmark-unique`** — ensure pages have a single `<main>`, single `<nav>`, etc.
- **`heading-order`** — pages start with `<h1>` (Header). Section headings inside the page use `<h2>`+.

## Rules

1. **Every interactive element must be reachable by keyboard.** No `onClick` on `<div>`. Use `<Button>` or `role="button" tabIndex={0}` with keyboard handlers (the `<FileDropzone>` primitive shows the canonical pattern).
2. **Every form input must have an accessible label.** Either via `<Label htmlFor>` or `<FormField>` (preferred — wires `aria-invalid` + `aria-describedby` automatically).
3. **Every icon-only button must have `aria-label`.** Decorative SVGs inside should have `aria-hidden`.
4. **Color must never be the sole signal.** Status badges already pair color with text; any new affordance must do the same.
5. **`<html lang="en">` is required.** The root layout sets it.
6. **Toasts use `aria-live` automatically via `sonner`.** Do not add `role="status"` manually to mutation feedback.

## Mobile a11y

Native a11y is governed by Expo + React Native conventions:

- Use `accessibilityLabel`, `accessibilityRole`, `accessibilityState` on touchable surfaces.
- Pressables must have a minimum 44x44 hit area.
- Test screens with VoiceOver (iOS) and TalkBack (Android) before shipping a major UI change.

## Verification

```bash
pnpm nx e2e webapp-e2e -- --grep "@a11y"
```

Local quick check (no Playwright):

```bash
pnpm nx serve webapp
# then in browser DevTools, run Lighthouse → Accessibility
```
