// Module 08 — Forms with react-hook-form + Zod Resolver
// Compares yup-based forms (old) with RHF + Zod + shared contract schemas (new).

export default {
    id: '08-forms-rhf-zod',
    level: 3,
    complexityLabel: 'L3 · Forms',
    domain: 'Webapp',
    title: 'Forms with react-hook-form + Zod',
    introShort: 'Both templates use react-hook-form — the switch is from yup to Zod, and from inline schemas to shared contract schemas.',
    intro: "Both templates use react-hook-form. The difference is the validation library and where the schema lives. The old template used yup with an inline schema defined per form component — disconnected from the backend. The new template uses Zod with the schema sourced from @mma/contracts/{domain} — the exact same schema the NestJS ZodValidationPipe validates against on the backend. One schema, two uses, zero duplication.",

    specTitle: 'Forms · Validation Rules',
    specBodyHtml: `
    <p><strong>Old template — react-hook-form + yup:</strong></p>
    <ul>
      <li>Still uses react-hook-form, but with <code>yupResolver</code> from <code>@hookform/resolvers/yup</code>.</li>
      <li>Yup schema defined <em>inline</em> in the component file (or a co-located <code>.structure.ts</code>) — not shared with the backend.</li>
      <li>Backend has its own separate validation (class-validator / NestJS pipes) — rules drift over time.</li>
      <li>Yup's <code>object().shape()</code> API is more verbose; error messages are baked into the schema string literals.</li>
      <li>TypeScript types inferred via <code>yup.InferType&lt;typeof schema&gt;</code> — less ergonomic than Zod's <code>z.infer&lt;&gt;</code>.</li>
    </ul>
    <p><strong>New template — react-hook-form + Zod + shared contracts:</strong></p>
    <ul>
      <li>Schema sourced from <code>@mma/contracts/{domain}</code> — shared with the NestJS <code>ZodValidationPipe</code>.</li>
      <li>Switch one import: <code>yupResolver</code> → <code>zodResolver</code>. Everything else in the form stays the same.</li>
      <li>Validation rules are the single source of truth — change the schema once, both frontend and backend update.</li>
      <li>Error messages live in <code>apps/webapp/src/lib/zod-error-map.ts</code> — one place for all copy, never inside the schema.</li>
      <li><code>aria-invalid</code> and <code>aria-describedby</code> wired automatically by <code>&lt;FormControl&gt;</code> from <code>@mma/ui</code>.</li>
      <li>Submit button disabled while submitting (<code>formState.isSubmitting</code>) — no change from the old pattern.</li>
    </ul>
    <p><strong>Golden Rule 23a:</strong> all forms use react-hook-form + Zod resolver with schemas from <code>@mma/contracts/{domain}</code>. Never use <code>yupResolver</code>.</p>
  `,

    entityFilename: 'create-user-form.tsx',
    entityCode: `// apps/webapp/src/components/users/create-user-form.tsx
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — react-hook-form + yup (libs/frontend in nx-template-v2)
// ─────────────────────────────────────────────────────────────────
// import { useForm } from 'react-hook-form';
// import { yupResolver } from '@hookform/resolvers/yup';   ← yup resolver
// import * as yup from 'yup';
//
// // ❌ Schema defined inline — not shared with the backend.
// //    Backend has its own class-validator rules that drift over time.
// const schema = yup.object({
//   email:     yup.string().email('Please enter a valid email').required('Required'),
//   firstName: yup.string().required('First name is required'),
//   lastName:  yup.string().required('Last name is required'),
//   userRole:  yup.string().oneOf(['USER', 'ADMIN']).required(),
// });
//
// // ❌ Type inferred from yup — more verbose than z.infer<>
// type CreateUserInput = yup.InferType<typeof schema>;
//
// export function CreateUserForm() {
//   const form = useForm<CreateUserInput>({
//     resolver: yupResolver(schema),   ← yup resolver
//   });
//   // ... rest of form markup is the same
// }

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — react-hook-form + Zod + shared schema
// ─────────────────────────────────────────────────────────────────
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// ✅ Schema imported from contracts — the SAME schema the NestJS pipe validates against.
import { createUserInputSchema } from '@mma/contracts/user';
import { useCreateUser } from '@mma/client-common';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
  Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@mma/ui';
import { UserRoleEnum } from '@mma/contracts/user';

type CreateUserInput = z.infer<typeof createUserInputSchema>;

export function CreateUserForm({ onSuccess }: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserInputSchema),  // ← Zod schema wired in one line
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      userRole: UserRoleEnum.USER,
    },
  });

  const { mutateAsync: createUser } = useCreateUser();

  async function onSubmit(data: CreateUserInput) {
    try {
      await createUser(data);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');  // ← Golden Rule 23c: always toast
      form.reset();
      onSuccess?.();
    } catch (err) {
      // ApiError carries statusCode + message from the backend DomainExceptionFilter
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="create-user-form">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                {/* FormControl sets aria-invalid + aria-describedby automatically */}
                <Input type="email" placeholder="user@example.com" {...field} />
              </FormControl>
              <FormMessage />  {/* renders the Zod error message inline */}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First name</FormLabel>
              <FormControl>
                <Input placeholder="Alice" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last name</FormLabel>
              <FormControl>
                <Input placeholder="Smith" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="userRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(UserRoleEnum).map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Disabled while submitting — prevents double-submit */}
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          data-testid="create-user-btn"
        >
          {form.formState.isSubmitting ? 'Creating…' : 'Create user'}
        </Button>
      </form>
    </Form>
  );
}`,

    concepts: [
        'Both templates use react-hook-form — only the resolver and schema source change',
        'yupResolver → zodResolver: one import swap, everything else stays the same',
        'Zod schema lives in @mma/contracts/{domain} — shared with the NestJS ZodValidationPipe',
        'Error messages live in zod-error-map.ts — never inside the schema or the form component',
        'FormControl auto-sets aria-invalid + aria-describedby for accessibility',
        'FormMessage renders Zod error messages inline — no separate error state',
        'toast.success/error (sonner) for action outcomes — never alert()',
        'isSubmitting disables the submit button — same pattern as old template',
    ],

    pitfalls: [
        '<strong>Using <code>yupResolver</code> in a new form:</strong> the old template used yup — if you copy a form from the old codebase, swap <code>yupResolver</code> for <code>zodResolver</code> and replace the yup schema with the corresponding import from <code>@mma/contracts/{domain}</code>.',
        '<strong>Defining the Zod schema inside the form file:</strong> never write <code>const schema = z.object({ ... })</code> in a component file. The schema must come from <code>@mma/contracts/{domain}</code> — the same one the backend validates against.',
        '<strong>Adding error message strings to the contract schema:</strong> <code>z.string().email(\'Please enter a valid email\')</code> is forbidden in contracts. Messages live in <code>apps/webapp/src/lib/zod-error-map.ts</code> only — the global error map handles them.',
        '<strong>Using <code>alert()</code> or <code>console.error()</code> for feedback:</strong> mutation outcomes must surface via <code>toast()</code> from <code>@mma/ui</code>. The <code>&lt;Toaster&gt;</code> is mounted once in <code>layout.tsx</code>.',
        "<strong>Forgetting <code>form.reset()</code> after success:</strong> without resetting, the form retains the last values when re-opened. Call <code>form.reset()</code> inside the success branch of <code>onSubmit</code>.",
    ],
};
