---
name: webapp-toast-notifications
description: Use sonner-based toasts for user feedback after mutations and other side-effecting actions in the webapp. Use this when adding any create/update/delete flow, file upload, sign-in, or other action that needs success/error feedback.
---

# Webapp Toast Notifications

The webapp uses [sonner](https://sonner.emilkowal.ski/) wrapped through `@old-st/ui`:
- `<Toaster>` — mounted once in `apps/webapp/src/app/layout.tsx`.
- `toast` — function for emitting toasts. Imported from `@old-st/ui`.

Source: `packages/ui/src/components/feedback/toast/toast.tsx`.

---

## Required Information — Ask First

1. **What action triggers the toast?** (mutation success, validation error, etc.)
2. **Should it offer an undo / retry action?** (Sonner supports actions out of the box.)

---

## Standard Pattern

```tsx
import { toast } from '@old-st/ui';

async function onSubmit(values) {
  try {
    await mutateAsync(values);
    toast.success('User created');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create user');
  }
}
```

For a destructive confirmation flow:

```tsx
toast('Delete this user?', {
  action: {
    label: 'Delete',
    onClick: () => deleteUser(id),
  },
});
```

For a long-running action with a promise:

```tsx
toast.promise(uploadFile(file), {
  loading: 'Uploading…',
  success: 'Uploaded',
  error: 'Upload failed',
});
```

---

## Rules

1. **Every mutation handler MUST surface success and error feedback.** Either a toast or an inline `<FormMessage>`. Never silently succeed/fail.
2. **Always import `toast` from `@old-st/ui`** — never directly from `sonner`. The re-export keeps the option open to swap providers later.
3. **Error toasts use the actual error message** when available — never a generic "Something went wrong" if the backend returned a meaningful one.
4. **Success toasts use a verb in past tense** — "User created", "Order updated", "File uploaded" — not "Successfully created user".
5. **Never use `alert()` or `window.confirm()`.** Use toast actions or `<AlertDialog>`.
6. **Don't toast for validation errors that have inline `<FormMessage>` rendering.** Inline errors are clearer for forms — toasts are for actions that complete (or fail) outside the form's visual scope.
7. **Toasts are global state — don't clear them manually.** Sonner auto-dismisses (4s default).

---

## Mounting

The `<Toaster>` is mounted exactly once in `apps/webapp/src/app/layout.tsx`:

```tsx
import { Toaster } from '@old-st/ui';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers apiConfig={apiConfig}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
```

Do not mount additional `<Toaster>`s elsewhere — sonner is a singleton.

---

## When NOT to Use Toasts

- Field-level validation feedback → use `<FormMessage>` inside the form.
- Destructive confirmations → use `<AlertDialog>` from `@old-st/ui`.
- Long forms with multiple errors → use a summary `<Alert>` at the top of the form.
- Permanent banners (e.g. "Your account is suspended") → use a layout-level banner, not a toast.
