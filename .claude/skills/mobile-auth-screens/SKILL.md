---
name: mobile-auth-screens
description: Build the authentication screen flow for the Expo mobile app — login, forgot password, confirm reset, new password (force-change). Use this when adding or modifying auth screens in apps/mobile/. Covers the auth stack routing, form patterns with react-hook-form + Zod, session flow (sign-in → discriminated response → navigation), and secure storage integration.
---

# Mobile Auth Screens

Authentication screens live outside the `(tabs)` group in an `(auth)` route group. They use `react-hook-form` + Zod with contract schemas from `@old-st/contracts/auth` and mutation hooks from `@old-st/client-common`.

Canonical references:
- Auth hooks: `packages/client-common/src/hooks/use-auth.ts`
- Auth contracts: `packages/contracts/auth/src/schemas.ts`
- AuthProvider: `packages/client-common/src/lib/providers.tsx`
- Secure storage: `apps/mobile/src/lib/secure-storage.ts`
- Root layout: `apps/mobile/src/app/_layout.tsx`

---

## Required Information — Ask First

1. **Which auth screens are needed?** (login, forgot-password, confirm-reset, new-password/force-change)
2. **Does the app have a sign-up flow?** (requires `POST /auth/sign-up` endpoint — does not exist in the default template)
3. **Is the auth stack already scaffolded?** (check for `apps/mobile/src/app/(auth)/` folder)

---

## File Structure

```
apps/mobile/src/app/
  _layout.tsx              ← Root Stack: includes (auth) and (tabs) groups
  (auth)/
    _layout.tsx            ← Auth stack layout (headerShown: false on Stack)
    login.tsx              ← Sign-in form
    forgot-password.tsx    ← Email entry → calls useForgotPassword
    confirm-reset.tsx      ← Code + new password → calls useConfirmForgotPassword
    new-password.tsx       ← Force-change on first login → calls useCompleteNewPassword
  (tabs)/
    _layout.tsx
    ...
```

---

## Auth Flow Sequence

```
App cold start
  │
  ├── AuthProvider calls refreshSession (httpOnly cookie)
  │   ├── Success → user is authenticated → show (tabs)
  │   └── Failure → no session → show (auth)/login
  │
Login screen
  │
  ├── useSignIn.mutate({ email, password })
  │   ├── Response type: 'SUCCESS' → tokens stored → navigate to (tabs)
  │   └── Response type: 'NEW_PASSWORD_REQUIRED' → navigate to (auth)/new-password
  │
Forgot Password screen
  │
  ├── useForgotPassword.mutate({ email })
  │   └── Success → navigate to (auth)/confirm-reset with email param
  │
Confirm Reset screen
  │
  ├── useConfirmForgotPassword.mutate({ email, code, newPassword })
  │   └── Success → navigate to (auth)/login
  │
New Password screen (force-change)
  │
  ├── useCompleteNewPassword.mutate({ session, email, newPassword })
  │   └── Success → tokens stored → navigate to (tabs)
```

---

## Auth Stack Layout

File: `apps/mobile/src/app/(auth)/_layout.tsx`

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#ffffff' },
        animation: 'slide_from_right',
      }}
    />
  );
}
```

**Rules:**
- `headerShown: false` — auth screens manage their own titles.
- White background for a clean auth experience.
- Use `slide_from_right` animation for forward navigation feel.

---

## Root Layout — Auth Guard

File: `apps/mobile/src/app/_layout.tsx`

The root layout must include the `(auth)` route group in the Stack and gate navigation based on auth state:

```tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@old-st/client-common';

// Inside RootLayout component:
function useProtectedRoute() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not signed in and not on auth screen → redirect to login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Signed in but on auth screen → redirect to tabs
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments]);
}
```

Then call `useProtectedRoute()` inside the `RootLayout` component, and register both route groups:

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(auth)" />
  <Stack.Screen name="(tabs)" />
</Stack>
```

**Rules:**
- Auth guard runs in the root layout — not in individual screens.
- Use `router.replace()` (not `push()`) for auth redirects — prevents back-navigating to login after signing in.
- Wait for `isLoading` to be false before redirecting to avoid flash-of-login on cold start.
- The `useAuth()` hook comes from `@old-st/client-common`'s `AuthProvider`.

---

## Login Screen

File: `apps/mobile/src/app/(auth)/login.tsx`

```tsx
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, Button, Input } from '@old-st/mobile-ui';
import { signInRequestSchema, type SignInRequest } from '@old-st/contracts/auth';
import { useSignIn } from '@old-st/client-common';
import { PasswordField } from '../../components/auth/password-field';

export default function LoginScreen() {
  const router = useRouter();
  const signIn = useSignIn();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInRequest>({
    resolver: zodResolver(signInRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignInRequest) {
    try {
      const result = await signIn.mutateAsync(values);

      if (result.type === 'NEW_PASSWORD_REQUIRED') {
        // First login with temp password — must set new password
        router.push({
          pathname: '/(auth)/new-password',
          params: { session: result.session, email: values.email },
        });
        return;
      }

      // type === 'SUCCESS' → AuthProvider stores tokens, useProtectedRoute redirects
    } catch {
      // Error displayed via mutation state below
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="heading">Sign In</Text>
          <Text variant="muted">Enter your credentials to continue</Text>
        </View>

        <View style={styles.form}>
          {/* Email */}
          <View style={styles.field}>
            <Text variant="caption" style={styles.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="you@example.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              )}
            />
            {errors.email && (
              <Text variant="caption" style={styles.error}>
                {errors.email.message}
              </Text>
            )}
          </View>

          {/* Password */}
          <PasswordField
            control={control}
            name="password"
            label="Password"
            errors={errors}
            textContentType="password"
            autoComplete="password"
          />

          {/* Server error */}
          {signIn.isError && (
            <Text variant="caption" style={styles.error}>
              {signIn.error instanceof Error ? signIn.error.message : 'Sign in failed'}
            </Text>
          )}

          {/* Submit */}
          <Button
            onPress={handleSubmit(onSubmit)}
            loading={signIn.isPending}
            disabled={signIn.isPending}
          >
            Sign In
          </Button>

          {/* Forgot password link */}
          <Button
            variant="ghost"
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            Forgot password?
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 32 },
  header: { gap: 4, alignItems: 'center' },
  form: { gap: 16 },
  field: { gap: 4 },
  label: { fontWeight: '600' },
  error: { color: '#ef4444' },
});
```

**Key patterns:**
- The `signInResponseSchema` is a **discriminated union** (`type: 'SUCCESS' | 'NEW_PASSWORD_REQUIRED'`). Always check `result.type` after `mutateAsync`.
- On `NEW_PASSWORD_REQUIRED`: navigate to new-password screen passing `session` + `email` as route params.
- On `SUCCESS`: AuthProvider auto-stores tokens. The `useProtectedRoute` guard in the root layout handles redirection to `(tabs)`.
- Do NOT call `router.replace('/(tabs)')` manually after success — let the auth guard handle it.

---

## Forgot Password Screen

File: `apps/mobile/src/app/(auth)/forgot-password.tsx`

```tsx
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, Button, Input } from '@old-st/mobile-ui';
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from '@old-st/contracts/auth';
import { useForgotPassword } from '@old-st/client-common';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const forgotPassword = useForgotPassword();

  const {
    control,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordRequest) {
    try {
      await forgotPassword.mutateAsync(values);
      router.push({
        pathname: '/(auth)/confirm-reset',
        params: { email: values.email },
      });
    } catch {
      // Error displayed via mutation state
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="heading">Forgot Password</Text>
          <Text variant="muted">We'll send a reset code to your email</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text variant="caption" style={styles.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="you@example.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              )}
            />
            {errors.email && (
              <Text variant="caption" style={styles.error}>
                {errors.email.message}
              </Text>
            )}
          </View>

          {forgotPassword.isError && (
            <Text variant="caption" style={styles.error}>
              {forgotPassword.error instanceof Error
                ? forgotPassword.error.message
                : 'Failed to send reset code'}
            </Text>
          )}

          <Button
            onPress={handleSubmit(onSubmit)}
            loading={forgotPassword.isPending}
            disabled={forgotPassword.isPending}
          >
            Send Reset Code
          </Button>

          <Button variant="ghost" onPress={() => router.back()}>
            Back to Sign In
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 32 },
  header: { gap: 4, alignItems: 'center' },
  form: { gap: 16 },
  field: { gap: 4 },
  label: { fontWeight: '600' },
  error: { color: '#ef4444' },
});
```

---

## Confirm Reset Screen

File: `apps/mobile/src/app/(auth)/confirm-reset.tsx`

```tsx
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, Button, Input } from '@old-st/mobile-ui';
import {
  confirmForgotPasswordRequestSchema,
  type ConfirmForgotPasswordRequest,
} from '@old-st/contracts/auth';
import { useConfirmForgotPassword } from '@old-st/client-common';
import { PasswordField } from '../../components/auth/password-field';

export default function ConfirmResetScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const confirmReset = useConfirmForgotPassword();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfirmForgotPasswordRequest>({
    resolver: zodResolver(confirmForgotPasswordRequestSchema),
    defaultValues: { email: email ?? '', code: '', newPassword: '' },
  });

  async function onSubmit(values: ConfirmForgotPasswordRequest) {
    try {
      await confirmReset.mutateAsync(values);
      router.replace('/(auth)/login');
    } catch {
      // Error displayed via mutation state
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="heading">Reset Password</Text>
          <Text variant="muted">Enter the code sent to {email}</Text>
        </View>

        <View style={styles.form}>
          {/* Code */}
          <View style={styles.field}>
            <Text variant="caption" style={styles.label}>Verification Code</Text>
            <Controller
              control={control}
              name="code"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  placeholder="Enter code"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                />
              )}
            />
            {errors.code && (
              <Text variant="caption" style={styles.error}>
                {errors.code.message}
              </Text>
            )}
          </View>

          {/* New Password */}
          <PasswordField
            control={control}
            name="newPassword"
            label="New Password"
            placeholder="Enter new password"
            errors={errors}
            textContentType="newPassword"
            autoComplete="new-password"
          />

          {confirmReset.isError && (
            <Text variant="caption" style={styles.error}>
              {confirmReset.error instanceof Error
                ? confirmReset.error.message
                : 'Failed to reset password'}
            </Text>
          )}

          <Button
            onPress={handleSubmit(onSubmit)}
            loading={confirmReset.isPending}
            disabled={confirmReset.isPending}
          >
            Reset Password
          </Button>

          <Button variant="ghost" onPress={() => router.replace('/(auth)/login')}>
            Back to Sign In
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 32 },
  header: { gap: 4, alignItems: 'center' },
  form: { gap: 16 },
  field: { gap: 4 },
  label: { fontWeight: '600' },
  error: { color: '#ef4444' },
});
```

---

## New Password Screen (Force-Change)

File: `apps/mobile/src/app/(auth)/new-password.tsx`

This screen appears when Cognito requires a password change on first login (`NEW_PASSWORD_REQUIRED` response type).

```tsx
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, Button } from '@old-st/mobile-ui';
import { newPasswordRequestSchema, type NewPasswordRequest } from '@old-st/contracts/auth';
import { useCompleteNewPassword } from '@old-st/client-common';
import { PasswordField } from '../../components/auth/password-field';

export default function NewPasswordScreen() {
  const { session, email } = useLocalSearchParams<{ session: string; email: string }>();
  const completeNewPassword = useCompleteNewPassword();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordRequest>({
    resolver: zodResolver(newPasswordRequestSchema),
    defaultValues: { session: session ?? '', email: email ?? '', newPassword: '' },
  });

  async function onSubmit(values: NewPasswordRequest) {
    try {
      await completeNewPassword.mutateAsync(values);
      // AuthProvider auto-stores tokens, useProtectedRoute redirects to (tabs)
    } catch {
      // Error displayed via mutation state
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="heading">Set New Password</Text>
          <Text variant="muted">Your account requires a new password</Text>
        </View>

        <View style={styles.form}>
          <PasswordField
            control={control}
            name="newPassword"
            label="New Password"
            placeholder="Choose a strong password"
            errors={errors}
            textContentType="newPassword"
            autoComplete="new-password"
          />

          {completeNewPassword.isError && (
            <Text variant="caption" style={styles.error}>
              {completeNewPassword.error instanceof Error
                ? completeNewPassword.error.message
                : 'Failed to set new password'}
            </Text>
          )}

          <Button
            onPress={handleSubmit(onSubmit)}
            loading={completeNewPassword.isPending}
            disabled={completeNewPassword.isPending}
          >
            Set Password & Continue
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 32 },
  header: { gap: 4, alignItems: 'center' },
  form: { gap: 16 },
  error: { color: '#ef4444' },
});
```

---

## Shared Auth Components

### PasswordField

File: `apps/mobile/src/components/auth/password-field.tsx`

See the `mobile-form-with-validation` skill → Password Field Pattern for the full implementation. This component is reused across login, confirm-reset, new-password, and change-password screens.

---

## Tests

Test files are co-located next to their source files:

```
apps/mobile/src/
  app/
    (auth)/
      login.tsx
      login.spec.tsx
      forgot-password.tsx
      forgot-password.spec.tsx
      confirm-reset.tsx
      confirm-reset.spec.tsx
      new-password.tsx
      new-password.spec.tsx
  components/
    auth/
      password-field.tsx
      password-field.spec.tsx
```

### Login Screen Test

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from './login';

const mockMutateAsync = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSegments: () => ['(auth)'],
  Stack: { Screen: () => null },
}));

jest.mock('@old-st/client-common', () => ({
  useSignIn: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
  useAuth: () => ({ user: null, isLoading: false }),
}));

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits credentials and handles SUCCESS response', async () => {
    mockMutateAsync.mockResolvedValue({ type: 'SUCCESS', accessToken: 'abc' });
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'admin@test.com');
    // Password field tested via PasswordField component tests
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'admin@test.com' }),
      );
    });
  });

  it('navigates to new-password on NEW_PASSWORD_REQUIRED', async () => {
    mockMutateAsync.mockResolvedValue({
      type: 'NEW_PASSWORD_REQUIRED',
      session: 'sess-123',
    });
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'user@test.com');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(auth)/new-password' }),
      );
    });
  });

  it('navigates to forgot-password screen', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Forgot password?'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/forgot-password');
  });
});
```

**Test checklist:**
- [ ] Submitting valid credentials calls `useSignIn.mutateAsync`
- [ ] `SUCCESS` response → AuthProvider handles, no manual navigation
- [ ] `NEW_PASSWORD_REQUIRED` → navigates to new-password with session + email params
- [ ] Server error shows error text
- [ ] "Forgot password?" navigates to forgot-password screen
- [ ] Validation errors show for empty email/password

---

## Common Mistakes to Avoid

| Bug | Fix |
|---|---|
| Manually navigating to `(tabs)` after sign-in SUCCESS | Let `useProtectedRoute` in root layout handle it — AuthProvider stores tokens, guard redirects |
| Using `router.push` for auth redirects | Use `router.replace` — prevents back-button returning to login |
| Not handling `NEW_PASSWORD_REQUIRED` response type | The sign-in response is a discriminated union — always check `result.type` |
| Storing refresh token in SecureStore | Refresh tokens stay in httpOnly cookies (RN cookie jar). Only the cached user goes in SecureStore |
| Flash of login screen on cold start | Wait for `isLoading` to be false in `useProtectedRoute` before redirecting |
| Passing `session` via global state | Pass `session` as a route param (`useLocalSearchParams`) — no global auth state needed for this one-time value |
