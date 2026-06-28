---
name: mobile-form-with-validation
description: Build forms in the Expo mobile app using react-hook-form + Zod resolver, reusing schemas from @mma/contracts so validation rules live in exactly one place. Use this when adding any create/edit/sign-in form on mobile. Covers field registration, inline error display, KeyboardAvoidingView, submission handling, and the differences from the webapp form pattern.
---

# Mobile Form with Validation (RHF + Zod)

Source schemas come from `@mma/contracts/{domain}` — **never duplicate Zod schemas in the mobile app**.

> **Key difference from webapp:** The webapp uses `<Form>`, `<FormField>`, `<FormItem>`, `<FormControl>`, `<FormMessage>` from `@mma/ui` (Radix Slot + `<form>` element). **None of these exist in React Native.** Mobile forms use `Controller` from `react-hook-form` directly, with `Input` from `@mma/mobile-ui` and manual error `<Text>` rendering.

---

## Required Information — Ask First

1. **Which domain?** (auth, user, product, order, ...)
2. **Which contract schema** is the form's source of truth? (e.g. `signInRequestSchema`, `createUserSchema`)
3. **Is it a create or edit form?** (edit needs `defaultValues` from server data)
4. **Where does it live?** (`apps/mobile/src/app/{domain}/create-{entity}.tsx` for a screen, or `apps/mobile/src/components/{domain}/{name}-form.tsx` for a reusable form component)
5. **Which mutation hook does it call?** (e.g. `useSignIn`, `useCreateUser` from `@mma/client-common`)

---

## File Layout

```
apps/mobile/src/app/{domain}/create-{entity}.tsx      ← form as a screen (navigable)
apps/mobile/src/components/{domain}/{name}-form.tsx    ← form as a reusable component
apps/mobile/src/components/auth/login-form.tsx         ← auth form example
```

---

## Standard Pattern

```tsx
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, Button, Input } from '@mma/mobile-ui';
import { createEntitySchema, type CreateEntityInput } from '@mma/contracts/{domain}';
import { useCreateEntity } from '@mma/client-common';

interface CreateEntityFormProps {
  onSuccess?: () => void;
}

export function CreateEntityForm({ onSuccess }: CreateEntityFormProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEntityInput>({
    resolver: zodResolver(createEntitySchema),
    defaultValues: { name: '', email: '' },
  });

  const { mutateAsync, isPending, isError, error } = useCreateEntity();

  async function onSubmit(values: CreateEntityInput) {
    try {
      await mutateAsync(values);
      reset();
      onSuccess?.();
    } catch {
      // Error is captured by mutation state — displayed below the form
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Field: Name */}
        <View style={styles.field}>
          <Text variant="caption" style={styles.label}>Name</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="Enter name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
              />
            )}
          />
          {errors.name && (
            <Text variant="caption" style={styles.error}>
              {errors.name.message}
            </Text>
          )}
        </View>

        {/* Field: Email */}
        <View style={styles.field}>
          <Text variant="caption" style={styles.label}>Email</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="Enter email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          />
          {errors.email && (
            <Text variant="caption" style={styles.error}>
              {errors.email.message}
            </Text>
          )}
        </View>

        {/* Server error */}
        {isError && (
          <Text variant="caption" style={styles.error}>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </Text>
        )}

        {/* Submit */}
        <Button
          onPress={handleSubmit(onSubmit)}
          loading={isPending}
          disabled={isPending}
        >
          Create
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 16 },
  field: { gap: 4 },
  label: { fontWeight: '600' },
  error: { color: '#ef4444' },
});
```

---

## Rules

1. **The Zod schema MUST come from `@mma/contracts/{domain}`.** Never define a form-specific schema in the mobile app. If the form needs extra UI-only validation (e.g. confirm-password), extend the contract schema with `.extend(...)` inline.
2. **Use `Controller` from `react-hook-form` — NOT `register()`.** The `register()` API relies on DOM refs (`HTMLInputElement`) which don't exist in React Native. Every field must use `<Controller>` with `render` prop.
3. **Wrap forms in `KeyboardAvoidingView` + `ScrollView`.** On iOS, the keyboard obscures bottom fields without `KeyboardAvoidingView`. Always add `keyboardShouldPersistTaps="handled"` on the `ScrollView` so tapping the submit button works while the keyboard is open.
4. **No `<form>` element.** React Native has no `<form>`. Submission is triggered by `handleSubmit(onSubmit)` wired to the Button's `onPress`.
5. **Error display is manual.** There is no `<FormMessage>` component. Render `errors.{fieldName}.message` as a `<Text variant="caption" style={styles.error}>` below each field.
6. **Submit button must reflect mutation state.** Use `loading={isPending}` and `disabled={isPending}` on the Button.
7. **Display server errors below the form.** Use `isError` + `error.message` from the mutation. Never use `Alert.alert()` for form validation errors (alert is for confirmations only).
8. **Reset the form on success** (`reset()`) unless it's a one-shot flow like sign-in.
9. **Edit forms pass `defaultValues` from the server query** — don't fetch inside the form, take it as a prop.
10. **Use platform-appropriate keyboard props.** Set `keyboardType`, `autoCapitalize`, `autoCorrect`, `secureTextEntry`, `textContentType`, and `autoComplete` based on the field type. This improves autofill and keyboard UX on both platforms.

---

## Webapp → Mobile Translation Guide

| Webapp (Web) | Mobile (React Native) | Notes |
|---|---|---|
| `<Form {...form}>` | _(none — no FormProvider needed)_ | Controller reads from `control` prop directly |
| `<form onSubmit={...}>` | `<Button onPress={handleSubmit(onSubmit)}>` | No `<form>` element in RN |
| `<FormField control={} name={} render={}>` | `<Controller control={} name={} render={}>` | Same concept, different import |
| `<FormItem>` | `<View style={styles.field}>` | Layout wrapper |
| `<FormLabel>` | `<Text variant="caption" style={styles.label}>` | Manual label |
| `<FormControl><Input .../></FormControl>` | `<Input ... />` inside Controller render | No Slot/FormControl wrapper |
| `<FormMessage />` | `{errors.name && <Text style={styles.error}>{errors.name.message}</Text>}` | Manual error display |
| `<Input type="email" autoComplete="email" {...field}>` | `<Input keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={value} onChangeText={onChange} onBlur={onBlur}>` | Spread `field` doesn't work in RN — destructure and pass explicitly |
| `toast.success('Created')` | Navigate back or show inline success | No toast primitive yet |
| `form.handleSubmit(onSubmit)` on `<form>` | `handleSubmit(onSubmit)` on `<Button onPress>` | Same handleSubmit, different trigger |

---

## Keyboard Props Reference

| Field type | `keyboardType` | `autoCapitalize` | `secureTextEntry` | `textContentType` (iOS) | `autoComplete` |
|---|---|---|---|---|---|
| Email | `email-address` | `none` | — | `emailAddress` | `email` |
| Password | `default` | `none` | `true` | `password` | `password` |
| New password | `default` | `none` | `true` | `newPassword` | `new-password` |
| Name | `default` | `words` | — | `name` | `name` |
| Phone | `phone-pad` | — | — | `telephoneNumber` | `tel` |
| Number | `numeric` | — | — | — | — |
| URL | `url` | `none` | — | `URL` | `url` |
| Code / OTP | `number-pad` | — | — | `oneTimeCode` | `one-time-code` |

---

## Password Field Pattern

Password fields need `secureTextEntry` toggle:

```tsx
import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text, Input } from '@mma/mobile-ui';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';

interface PasswordFieldProps {
  control: Control<any>;
  name: string;
  label: string;
  placeholder?: string;
  errors: FieldErrors;
  textContentType?: 'password' | 'newPassword';
  autoComplete?: 'password' | 'new-password';
}

export function PasswordField({
  control,
  name,
  label,
  placeholder = 'Enter password',
  errors,
  textContentType = 'password',
  autoComplete = 'password',
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const fieldError = errors[name];

  return (
    <View style={styles.field}>
      <Text variant="caption" style={styles.label}>{label}</Text>
      <View style={styles.passwordRow}>
        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              style={styles.passwordInput}
              placeholder={placeholder}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={textContentType}
              autoComplete={autoComplete}
            />
          )}
        />
        <Pressable onPress={() => setVisible((v) => !v)} style={styles.toggle}>
          <Text variant="caption">{visible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>
      {fieldError && (
        <Text variant="caption" style={styles.error}>
          {fieldError.message as string}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontWeight: '600' },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  toggle: { paddingHorizontal: 12, paddingVertical: 8 },
  error: { color: '#ef4444' },
});
```

**Rules for password fields:**
- Default to `secureTextEntry={true}` — toggle with state.
- Use `textContentType="password"` for existing passwords, `"newPassword"` for new/reset flows (iOS autofill distinguishes these).
- Use `autoComplete="password"` / `"new-password"` for Android autofill.
- Always set `autoCapitalize="none"` and `autoCorrect={false}`.

---

## Tests

Test forms are co-located — `{name}-form.spec.tsx` next to `{name}-form.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { CreateEntityForm } from './create-entity-form';

const mockMutateAsync = jest.fn();

jest.mock('@mma/client-common', () => ({
  useCreateEntity: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

describe('CreateEntityForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits valid input to the mutation', async () => {
    mockMutateAsync.mockResolvedValue({});
    render(<CreateEntityForm />);

    fireEvent.changeText(screen.getByPlaceholderText('Enter name'), 'Alice');
    fireEvent.changeText(screen.getByPlaceholderText('Enter email'), 'alice@test.com');
    fireEvent.press(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ name: 'Alice', email: 'alice@test.com' });
    });
  });

  it('shows validation error for empty required fields', async () => {
    render(<CreateEntityForm />);
    fireEvent.press(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeTruthy();
    });
  });
});
```

**Test checklist:**
- [ ] Submitting valid data calls the mutation with correct values
- [ ] Empty required fields show validation errors
- [ ] Server error renders below the form
- [ ] `onSuccess` callback is invoked after successful mutation
- [ ] Button shows loading state during submission (`isPending`)

---

## Common Mistakes to Avoid

| Bug | Fix |
|---|---|
| Using `register()` instead of `Controller` | RN inputs have no DOM refs — always use `Controller` + `render` |
| Using `<FormField>` / `<FormMessage>` from `@mma/ui` | These are web-only (Radix Slot). Use `Controller` + manual error text |
| Spreading `{...field}` from Controller render | RN `TextInput` uses `onChangeText` not `onChange`. Destructure: `{ onChange, onBlur, value }` and pass `onChangeText={onChange}` |
| Keyboard covers bottom fields | Wrap in `KeyboardAvoidingView` with platform-specific `behavior` |
| Tap on submit doesn't work with keyboard open | Add `keyboardShouldPersistTaps="handled"` to `ScrollView` |
| Password shows in plain text by default | Default `secureTextEntry={true}`, toggle with state |
| Using `Alert.alert()` for validation errors | Use inline error text. `Alert.alert` is for destructive confirmations only |
| Missing `defaultValues` | RHF requires explicit defaults for every field. Use empty strings for text |
