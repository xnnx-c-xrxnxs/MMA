# Frontend Todo — `apps/webapp`

> **Context:** The styling migration from SCSS (nx-template-v2) to Tailwind v4 + design tokens
> is complete at the `packages/ui` level. The `apps/webapp` pages still need three
> types of cleanup described below. Read the [Golden Rules](CLAUDE.md#2-golden-rules-always-enforced)
> before starting — rules #19, #21, #23a, #23j, and #23o are the most relevant.

---

## Rule 1 — Fix hardcoded Tailwind color classes → semantic tokens

**Where:** Any `className` that uses a concrete Tailwind palette name instead of a semantic
CSS variable token.

**Find them with:**
```bash
grep -r "text-green-\|text-red-\|text-blue-\|text-yellow-\|bg-green-\|bg-red-\|bg-blue-\|text-\[#\|bg-\[#" apps/webapp/src
```

**Current violations (2 files):**

| File | Line | Bad class | Replace with |
|---|---|---|---|
| `apps/webapp/src/app/auth/forgot-password/page.tsx` | 61 | `text-green-600` | `text-success-text` |
| `apps/webapp/src/app/(protected)/change-password/page.tsx` | 116 | `text-green-600` | `text-success-text` |

**Why:** `text-green-600` is a hardcoded Tailwind palette step — it does not adapt to dark
mode. `text-success-text` resolves to `var(--color-success-text)` which the `.dark` block
overrides automatically (Golden Rule #23j).

All available semantic tokens are in [`packages/design-tokens/src/lib/tokens.ts`](packages/design-tokens/src/lib/tokens.ts).
The compiled CSS variables are in [`packages/design-tokens/src/lib/tokens.css`](packages/design-tokens/src/lib/tokens.css).

---

## Rule 2 — Implement Golden Rule #19: Pages as thin orchestrators

**Rule:** A page component wires hooks + state + child components. It must **not** contain
table markup, form field markup, or direct API call logic. That belongs in
`apps/webapp/src/components/{domain}/`.

### Pages with violations

#### `apps/webapp/src/app/(protected)/users/[userId]/page.tsx`
**Problem:** The entire edit-profile form (Input fields, Save/Cancel buttons, role Select,
action buttons) is inline in the page. The page is ~150 lines.

**Fix:** Extract two components into `apps/webapp/src/components/users/`:
- `UserProfileCard` — read/edit view with the profile fields and inline edit form
- The action buttons (Verify Email, Activate, Deactivate, Delete) can move into
  the existing `UserActions` component (it already handles the list view; extend
  it to accept a `variant="detail"` prop for the detail page layout)

Page after refactor should be ~25 lines: resolve `userId` from params → call
`useUser()` → handle loading/error → render `<UserProfileCard>` +
`<UserActions variant="detail">`.

---

#### `apps/webapp/src/app/(protected)/products/[productId]/page.tsx`
**Problem:** Inline price editing (Input + state), inventory editing (Input + state),
and all action buttons are in the page. ~170 lines.

**Fix:** Extract into `apps/webapp/src/components/products/`:
- `ProductDetailsCard` — read view + inline price/inventory edit forms
- Action buttons (Activate, Deactivate, Discontinue, Delete) → extend the
  existing `ProductActions` component

---

#### `apps/webapp/src/app/(protected)/orders/[orderId]/page.tsx`
**Problem:** The items table (`<Table>` with rows, header, cells) is inline in the page.

**Fix:** Extract `OrderItemsTable` into `apps/webapp/src/components/orders/`.
The page should only render `<OrderInfoCard>` and `<OrderItemsTable>`.

---

#### `apps/webapp/src/app/auth/forgot-password/page.tsx`
#### `apps/webapp/src/app/auth/login/page.tsx`
#### `apps/webapp/src/app/(protected)/change-password/page.tsx`
**Problem:** All three use raw `useState` for form state and raw `<label>` (not the
`<Label>` primitive from `@mma/ui`). They also bypass `react-hook-form`.

**Fix per Golden Rule #23a:** Replace with `react-hook-form` + Zod resolver, sourcing
the schema from the relevant `@mma/contracts/{domain}` package. Wrap fields in
`<FormField>` + `<FormItem>` + `<FormControl>` + `<FormMessage>` from `@mma/ui`.
This gives `aria-invalid` / `aria-describedby` and inline error rendering for free.

Read the `webapp-form-with-validation` skill before starting:
`.claude/skills/webapp-form-with-validation/SKILL.md`

---

#### `apps/webapp/src/components/users/create-user-form.tsx`
#### `apps/webapp/src/components/products/create-product-form.tsx`
#### `apps/webapp/src/components/orders/create-order-form.tsx`
**Same problem as auth pages above** — raw `useState` + raw `<Input>` wiring.
Same fix: `react-hook-form` + Zod + `<FormField>`.

---

## Rule 3 — Move from SSR to SSG ✅ COMPLETE

~~**Background:** All protected pages use `'use client'` because they call React Query
hooks directly. The `(protected)/layout.tsx` also uses `'use client'` for the auth
redirect. These pages currently have no `generateStaticParams` or explicit rendering
config, so Next.js defaults them to dynamic (SSR) at request time.~~

**Status:** Static export is now complete. `apps/webapp/next.config.js` uses `output: 'export'`, all dynamic route segments have `generateStaticParams() { return []; }` + `dynamicParams = false`, and the `(protected)/layout.tsx` auth redirect uses `useAuth()` + `useRouter()` (client-side only — `middleware.ts` was deleted as it is incompatible with `output: 'export'`).

The webapp builds to `apps/webapp/out/` and deploys to S3 + CloudFront via the CD pipeline.

~~### What to add to every page and layout~~

~~**Step 1** — Add to the root `apps/webapp/next.config.js`:~~
~~**Step 2** — For dynamic route segments…~~
~~**Step 3** — Add `export const dynamicParams = false`…~~
~~**Step 4** — Replace the `(protected)/layout.tsx` auth redirect…~~

---

## Rule 4 — Replace raw `<label>` with `<Label>` from `@mma/ui`

**Golden Rule #21:** Never use raw HTML `<label>`. Use the `<Label>` primitive from
`@mma/ui` so `aria-invalid` / `aria-describedby` wiring is consistent.

**Current violations (13 occurrences across 5 files):**

| File | Notes |
|---|---|
| `apps/webapp/src/app/auth/login/page.tsx` | 2 raw `<label>` tags |
| `apps/webapp/src/app/auth/new-password/page.tsx` | 2 raw `<label>` tags |
| `apps/webapp/src/app/auth/forgot-password/page.tsx` | 3 raw `<label>` tags |
| `apps/webapp/src/app/(protected)/change-password/page.tsx` | 3 raw `<label>` tags |
| `apps/webapp/src/components/orders/create-order-form.tsx` | 2 raw `<label>` tags |

These will be naturally fixed when the form files are converted to `react-hook-form` +
`<FormField>` (Rule 2 above), since `<FormLabel>` from `@mma/ui` replaces `<label>`
inside that pattern. Do not fix them in isolation — fix them as part of Rule 2.

---

## Rule 5 — Define a font in `layout.tsx`

**Problem:** `apps/webapp/src/app/layout.tsx` has no font import. The app currently
renders in the browser's default font (usually Times New Roman or serif).

The old template used Helvetica Neue via `@font-face` in a SCSS file. The new template
has no equivalent. `tokens.ts` defines `fontSizes` but no `fontFamily`.

**Fix:**

Step 1 — Add Inter (or Geist) via `next/font/google` in `layout.tsx`:
```tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans">
        ...
      </body>
    </html>
  );
}
```

Step 2 — Add `fontFamily` to `packages/ui/src/lib/tokens.ts` and wire `--font-sans`
into the `@theme` block in `tokens.css` (via `pnpm tokens:gen`) so mobile and Storybook
can reference it from the same source of truth.

---

## Rule 6 — Do not add API routes for secrets

`apps/webapp` has no `app/api/` routes today — this is intentional. The nx-template-v2
had `/api/secrets` which proxied AWS Secrets Manager values to the browser. **Do not
replicate this pattern.** It is both a security anti-pattern (secrets that reach the
browser are no longer secrets) and incompatible with `output: 'export'` (SSG deletes
all API routes at build time).

The correct pattern is already in place:
- Backend secrets → `SecretsConfig.resolve()` in Lambda `main.ts` at cold-start, never sent to client
- Public config the browser needs (API URLs, Cognito client ID) → `NEXT_PUBLIC_*` env vars baked in at `next build`

---

## Summary checklist

> **Status:** Rules 1, 2, 4, 5 are **COMPLETE** for both `apps/webapp/` and the
> canonical mirror in `examples/apps/webapp/` (kept in lockstep so the developer
> reference shows the correct patterns). Rule 3 (SSG) is **deferred** — see ADR
> note below. Rule 6 stands as a permanent guardrail.

```
✅ Token fixes
[x] apps/webapp/src/app/auth/forgot-password/page.tsx — text-success-text
[x] apps/webapp/src/app/(protected)/change-password/page.tsx — text-success-text
[x] examples mirror — same fixes applied

✅ Golden Rule #19 — pages as thin orchestrators
[x] (protected)/users/[userId]/page.tsx — UserProfileCard + UserActions(variant="detail")
[x] (protected)/products/[productId]/page.tsx — ProductDetailsCard + ProductActions(variant="detail")
[x] (protected)/orders/[orderId]/page.tsx — OrderItemsTable
[x] examples mirror — same extractions applied

✅ Golden Rule #21 + #23a — react-hook-form + Zod (raw <label> removed via <FormLabel>)
[x] auth/login/page.tsx
[x] auth/new-password/page.tsx
[x] auth/forgot-password/page.tsx
[x] (protected)/change-password/page.tsx
[x] examples auth pages — same conversions applied
[x] examples create-user-form / create-product-form / create-order-form — converted

✅ Font
[x] packages/ui/src/lib/tokens.ts — added `fontFamilies` (sans, mono) using `var(--font-…)` cascade
[x] scripts/generate-css-tokens.mjs — emits `--font-{key}` in @theme block
[x] packages/ui/src/lib/tokens.css — regenerated (committed)
[x] apps/webapp/src/app/layout.tsx + examples mirror — wired Inter via next/font/google
[x] .claude/skills/fe-design-tokens/SKILL.md — documented the next/font integration

⏸️ SSG migration — DEFERRED (see ADR below)
[ ] next.config.js — output: 'export'
[ ] (protected)/{users,products,orders}/[id]/page.tsx — generateStaticParams + dynamicParams
[ ] (protected)/layout.tsx — switch to middleware.ts auth gate

🛡️ Rule 6 — never proxy secrets through the webapp
[x] apps/webapp/src/app/api/ — intentionally absent; permanent guardrail
```

### ADR — Rule 3 (SSG) deferred

The current webapp ships with `output: 'standalone'` because it is deployed via
the **AWS Lambda Web Adapter** Docker image (Golden Rule #40) and the Edge
middleware (`middleware.ts`) is the auth-marker-cookie gate (Golden Rule #23e).
Switching to `output: 'export'` would:

1. Disable Edge middleware → Golden Rule #23e regresses to a runtime-only check.
2. Break the Lambda Web Adapter image (`next start` is required by the runtime).
3. Force a parallel S3+CloudFront deployment path before the migration is safe.

This is a multi-file infra change, not a frontend cleanup. Capture as an ADR
in `docs/` if/when the team decides to split static-shell hosting from the
authenticated dashboard. Until then, the standalone Lambda image is the
documented deployment target.

### Skill / prompt updates that locked in these patterns

| File | Change |
|---|---|
| [.claude/skills/fe-design-tokens/SKILL.md](.claude/skills/fe-design-tokens/SKILL.md) | Documented `fontFamilies` token + the `next/font` cascade and "how to swap a font" workflow |
| [.claude/skills/webapp-form-with-validation/SKILL.md](.claude/skills/webapp-form-with-validation/SKILL.md) | Already enforces RHF + Zod resolver + `toast` on success/error — verified aligned |
| [.claude/skills/webapp-new-page/SKILL.md](.claude/skills/webapp-new-page/SKILL.md) | Already enforces page-as-thin-orchestrator — verified aligned |
| [examples/apps/webapp/](examples/apps/webapp/) | All auth pages, create forms, and detail pages now follow the canonical pattern. Developers copying from `examples/` get correct code by default. |


---

## Key files to read before starting

| File | Why |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Full Golden Rules (#19, #21, #23a, #23j) |
| [`packages/ui/src/lib/tokens.ts`](packages/ui/src/lib/tokens.ts) | All semantic token names |
| [`.claude/skills/webapp-form-with-validation/SKILL.md`](.claude/skills/webapp-form-with-validation/SKILL.md) | react-hook-form pattern used here |
| [`.claude/skills/webapp-new-page/SKILL.md`](.claude/skills/webapp-new-page/SKILL.md) | Page + component split pattern |
| [`.claude/skills/webapp-error-boundaries/SKILL.md`](.claude/skills/webapp-error-boundaries/SKILL.md) | error.tsx / loading.tsx requirements |
| [`apps/webapp/src/app/(protected)/users/page.tsx`](apps/webapp/src/app/(protected)/users/page.tsx) | Reference — this page already follows Golden Rule #19 correctly |
| [`apps/webapp/src/components/users/users-table.tsx`](apps/webapp/src/components/users/users-table.tsx) | Reference — good component extraction example |
