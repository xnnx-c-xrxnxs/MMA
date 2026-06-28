---
name: webapp-form-with-validation
description: Build forms in the webapp using react-hook-form + Zod resolver, reusing schemas from @mma/contracts so validation rules live in exactly one place. Use this when adding any create/edit/sign-in form, or when refactoring an existing useState-driven form. Covers field registration, error display, optimistic disabled state, and toast wiring.
---

# Webapp Form with Validation (RHF + Zod)

Canonical form primitives live in `@mma/ui`:
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`
- Source: `packages/ui/src/components/form-controls/form/form.tsx`

Source schemas come from `@mma/contracts/{domain}` — **never duplicate Zod schemas in the webapp**.

---

## Required Information — Ask First

1. **Which domain?** (user, product, order, auth, ...)
2. **Which contract schema** is the form's source of truth? (e.g. `signInSchema`, `createUserSchema`)
3. **Is it a create or edit form?** (edit needs `defaultValues` from server data)
4. **Where does it live?** (`apps/webapp/src/components/{domain}/{name}-form.tsx`)
5. **Which mutation hook does it call?** (e.g. `useCreateUser` from `@mma/client-common`)

---

## File Layout

```
apps/webapp/src/components/{domain}/{name}-form.tsx
```

`'use client'` — RHF requires the client.

---

## Standard Pattern

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from '@mma/ui';
import { createEntitySchema, type CreateEntityInput } from '@mma/contracts/{domain}';
import { useCreateUser } from '@mma/client-common';

export function CreateUserForm({ onSuccess }: { onSuccess?: () => void }) {
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: '', name: '' },
  });

  const { mutateAsync, isPending } = useCreateUser();

  async function onSubmit(values: CreateUserInput) {
    try {
      await mutateAsync(values);
      toast.success('User created');
      form.reset();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        data-testid="create-user-form"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create user'}
        </Button>
      </form>
    </Form>
  );
}
```

---

## Rules

1. **The Zod schema MUST come from `@mma/contracts/{domain}`.** Never define a form-specific schema in the webapp. If the form needs extra UI-only validation (e.g. confirm-password), extend the contract schema with `.extend(...)` inline — but the *core fields* always come from contracts.
2. **`<Form>` is `FormProvider` from RHF re-exported.** Spread `{...form}` into it so child fields see the form context.
3. **Wrap every input in `<FormField>` + `<FormItem>` + `<FormControl>` + `<FormMessage>`.** This is what wires `aria-invalid`, `aria-describedby`, and renders the per-field error text automatically.
4. **`<FormControl>` uses Radix `<Slot>`** — pass exactly one child (the actual input/select/etc.). The Slot forwards the form's id, ARIA attributes, and ref onto it.
5. **Submit button must reflect mutation state.** Disable while `isPending`; change label to indicate progress.
6. **Toast on success and on error.** Import `toast` from `@mma/ui`. Never `alert()`. Never silently swallow.
7. **Reset the form on success** (`form.reset()`) unless the form is a one-shot like sign-in.
8. **Forms keep `data-testid="..."` on the `<form>` element** for E2E tests (canonical IDs in `apps/webapp-e2e/src/utils/selectors.ts`).
9. **Edit forms pass `defaultValues` from the server query**, e.g. `defaultValues: existingUser` — don't fetch inside the form, take it as a prop.

---

## Common Pitfalls

| Bug | Fix |
|---|---|
| `<FormMessage>` not rendering errors | The field is not wrapped in `<FormField>` — or you forgot to set `name`. |
| `aria-invalid` not firing | The input is not inside `<FormControl>`. |
| Submit fires twice | Don't put `onSubmit` on both `<form>` and `<Button>`. The button's `type="submit"` is enough. |
| Form data is `undefined` | `defaultValues` is missing — RHF requires explicit defaults for every field. |
| `react-hook-form` resolver type errors | The Zod schema must match the form values type — use `z.infer<typeof schema>`. |

---

## Tests

Test forms via `@testing-library/react` + user-event:
- Type into fields, submit the form, assert the mutation was called with parsed values.
- Submit invalid input, assert `<FormMessage>` text appears.
- See `write-webapp-tests` skill for the test setup boilerplate.
