# Mobile Development Handbook

> Team reference for building the React Native mobile app. Covers architecture decisions, conventions, and day-to-day patterns.

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | React Native | 0.79+ |
| **Platform** | Expo (managed + prebuild) | SDK 54 |
| **Language** | TypeScript (strict mode) | 5.x |
| **Navigation** | Expo Router (file-based) | v4 |
| **Data fetching** | React Query (TanStack Query) | v5 |
| **API clients** | Typed `fetch` + Zod validation | shared `@old-st/client-common` |
| **UI primitives** | Shared component library | `@old-st/mobile-ui` |
| **Types/contracts** | Zod schemas (shared with backend + webapp) | `@old-st/contracts/{domain}` |
| **Auth** | AuthProvider + `expo-secure-store` | `@old-st/client-common` |
| **Error tracking** | Sentry | `@sentry/react-native` |
| **Build/deploy** | EAS Build + EAS Update | `eas.json` |
| **Testing** | Jest + React Native Testing Library | `jest-expo` |
| **Architecture** | React Native New Architecture (Fabric) | enabled |

### What We Don't Use (and Why)

| Technology | Reason |
|---|---|
| Redux / Zustand / MobX | React Query handles server state. `useState` + Context handles UI state. |
| Axios | `@old-st/client-common` uses typed `fetch` + Zod. Better runtime safety, smaller bundle. |
| React Navigation (standalone) | Expo Router gives file-based routing + type-safe links + deep linking for free. |
| Styled Components / Emotion | `StyleSheet.create()` + theme tokens. No runtime overhead. |
| Expo Go | We use dev clients (`npx expo prebuild`) for native module support. |

---

## 2. Folder Architecture

```
apps/mobile/
├── app.config.ts                 ← Dynamic Expo config (env-driven per build profile)
├── eas.json                      ← EAS Build profiles (development, preview, production)
├── metro.config.js               ← Metro bundler config (Nx workspace + SVG transformer)
├── jest.config.cts               ← Jest config (70% coverage threshold)
├── index.js                      ← expo-router/entry
├── assets/
│   └── images/                   ← App icon, adaptive icon, splash, favicon
└── src/
    ├── app/                      ← ROUTES — Expo Router file-based navigation
    │   ├── _layout.tsx           ← Root providers (QueryClient, Auth, SafeArea, Sentry)
    │   ├── index.tsx             ← Entry redirect (→ tabs or → auth)
    │   ├── auth/                 ← Public auth screens (login, forgot password)
    │   │   ├── _layout.tsx       ← Stack navigator for auth flow
    │   │   ├── login.tsx
    │   │   ├── forgot-password.tsx
    │   │   └── reset-password.tsx
    │   ├── (tabs)/               ← Protected tab navigator
    │   │   ├── _layout.tsx       ← Tab bar configuration
    │   │   ├── index.tsx         ← Home tab
    │   │   ├── search.tsx        ← Search tab
    │   │   └── profile.tsx       ← Profile tab
    │   └── {domain}/             ← Detail screens (dynamic routes)
    │       └── [{entity}Id].tsx
    │
    ├── components/               ← DOMAIN-SCOPED UI COMPONENTS
    │   ├── auth/                 ← Auth-related components
    │   │   ├── login-form.tsx
    │   │   └── forgot-password-form.tsx
    │   ├── profile/              ← Profile-related components
    │   │   └── profile-card.tsx
    │   ├── {domain}/             ← Per-domain components (mirrors app/ structure)
    │   │   └── {domain}-list.tsx
    │   └── shared/               ← Cross-domain reusable components
    │       └── screen-header.tsx
    │
    ├── lib/                      ← UTILITIES — pure functions, no React
    │   ├── secure-storage.ts     ← expo-secure-store TokenStorage adapter
    │   └── status-variants.ts    ← Badge variant mapping per entity status
    │
    ├── tests/                    ← ALL TEST FILES (mirrors src/ structure)
    │   ├── components/
    │   │   ├── auth/
    │   │   │   └── login-form.spec.tsx
    │   │   ├── profile/
    │   │   │   └── profile-card.spec.tsx
    │   │   └── {domain}/
    │   │       └── {domain}-list.spec.tsx
    │   └── lib/
    │       └── status-variants.spec.ts
    │
    ├── test-setup.ts             ← Jest test setup
    └── test-env-setup.ts         ← Jest env setup
```

### Shared Monorepo Packages (Do Not Duplicate)

| Package | Location | Purpose |
|---|---|---|
| `@old-st/mobile-ui` | `packages/mobile-ui/` | Shared RN primitives (Badge, Button, Card, Text, Input, etc.) |
| `@old-st/client-common` | `packages/client-common/` | API clients, React Query hooks, AuthProvider, QueryClient |
| `@old-st/contracts/{domain}` | `packages/contracts/{domain}/` | Zod schemas, TypeScript types, enum constants |

**Rule:** If it's UI-generic (Button, Card, Badge), it goes in `@old-st/mobile-ui`. If it's data-access (API client, hook), it goes in `@old-st/client-common`. If it's domain-specific UI (OrdersList, UserCard), it goes in `apps/mobile/src/components/{domain}/`.

---

## 3. Routing Conventions

### File = Route

Expo Router maps files in `src/app/` to routes automatically:

| File | URL | Description |
|---|---|---|
| `src/app/index.tsx` | `/` | Entry point (redirect) |
| `src/app/(tabs)/index.tsx` | `/(tabs)` | Home tab |
| `src/app/(tabs)/search.tsx` | `/(tabs)/search` | Search tab |
| `src/app/(tabs)/profile.tsx` | `/(tabs)/profile` | Profile tab |
| `src/app/auth/login.tsx` | `/auth/login` | Login screen |
| `src/app/{domain}/[{entity}Id].tsx` | `/{domain}/{id}` | Detail screen |

### Layout Files (`_layout.tsx`)

Every directory can have a `_layout.tsx` that wraps all routes inside it:

- **Root `_layout.tsx`** — providers (QueryClient, Auth, SafeArea, Sentry)
- **`(tabs)/_layout.tsx`** — `<Tabs>` navigator with tab bar config
- **`auth/_layout.tsx`** — `<Stack>` navigator with back button, no tab bar

### Parenthesized Folders

`(tabs)` means the folder name is NOT part of the URL. It's purely organizational.

### Navigation

```tsx
import { useRouter, Link } from 'expo-router';

// Imperative navigation
const router = useRouter();
router.push('/users/abc-123');
router.replace('/auth/login');
router.back();

// Declarative navigation
<Link href="/users/abc-123">View User</Link>
```

### Dynamic Routes

Use `[paramName].tsx` for dynamic segments:

```tsx
// File: src/app/users/[userId].tsx
import { useLocalSearchParams } from 'expo-router';

export default function UserDetail() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  // ...
}
```

---

## 4. Screen & Component Patterns

### Screens Are Thin Orchestrators

Screens (files in `src/app/`) wire together hooks, state, and child components. They do NOT contain list markup, form fields, or direct API calls.

```tsx
// ✅ Good — screen orchestrates
export default function UsersScreen() {
  const [status, setStatus] = useState('ALL');
  const { data, isLoading } = useUsersByStatus({ userStatus: status });

  return (
    <SafeAreaView style={styles.container}>
      <StatusFilter selected={status} onSelect={setStatus} />
      <UsersList users={data?.data ?? []} isLoading={isLoading} />
    </SafeAreaView>
  );
}

// ❌ Bad — screen has list rendering logic
export default function UsersScreen() {
  const { data } = useUsersByStatus({ userStatus: 'ACTIVE' });
  return (
    <FlatList
      data={data?.data}
      renderItem={({ item }) => (
        <View>
          <Text>{item.firstName} {item.lastName}</Text>
          {/* 50 more lines of markup */}
        </View>
      )}
    />
  );
}
```

### Component Folder Structure

Components mirror the `app/` directory structure:

```
src/components/
  auth/                    ← Components used by auth screens
    login-form.tsx
  profile/                 ← Components used by profile screen
    profile-card.tsx
  users/                   ← Components used by users screens
    users-list.tsx
    user-detail-card.tsx
  shared/                  ← Cross-domain components
    screen-header.tsx
    filter-bar.tsx
```

### Lists Always Use FlatList

```tsx
// ✅ Good — FlatList virtualizes long lists
<FlatList
  data={users}
  keyExtractor={(item) => item.userId}
  renderItem={({ item }) => <UserListItem user={item} />}
  onEndReached={onLoadMore}
  onEndReachedThreshold={0.5}
  ListEmptyComponent={<EmptyState message="No users found" />}
/>

// ❌ Bad — ScrollView + map renders all items (no virtualization)
<ScrollView>
  {users.map((user) => (
    <UserListItem key={user.userId} user={user} />
  ))}
</ScrollView>
```

### Component File Template

```tsx
import { View, StyleSheet } from 'react-native';
import { Text, Badge } from '@old-st/mobile-ui';

// 1. Types at the top
interface UserCardProps {
  name: string;
  status: string;
  onPress?: () => void;
}

// 2. Component
export function UserCard({ name, status, onPress }: UserCardProps) {
  return (
    <View style={styles.container}>
      <Text variant="subheading">{name}</Text>
      <Badge variant="success">{status}</Badge>
    </View>
  );
}

// 3. Styles at the bottom — always StyleSheet.create()
const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 8,
  },
});
```

---

## 5. Data Fetching & State Management

### API Communication — Always Through `@old-st/client-common`

Never call `fetch` directly. Use the shared hooks and API clients:

```tsx
import { useAuth, useSignIn, useSignOut } from '@old-st/client-common';

// Read auth state
const { user, isAuthenticated, isLoading } = useAuth();

// Mutations
const signIn = useSignIn();
await signIn.mutateAsync({ email, password });
```

### Server State = React Query

React Query IS your state management for anything that comes from the API:

```tsx
// Query (auto-cached, auto-refetched)
const { data, isLoading, error } = useUsersByStatus({ userStatus: 'ACTIVE' });

// Mutation (auto-invalidates cache on success)
const createUser = useCreateUser();
createUser.mutate(input, {
  onSuccess: () => toast('User created'),
  onError: (err) => toast(err.message),
});
```

### Local UI State = useState

For filter selections, form inputs, modal visibility — plain `useState`:

```tsx
const [selectedTab, setSelectedTab] = useState('all');
const [searchQuery, setSearchQuery] = useState('');
```

### When to Use Context

Only for truly global UI state that multiple unrelated components need:

- ✅ Theme preference (light/dark)
- ✅ Toast/overlay provider
- ❌ User data (use `useAuth()` from `@old-st/client-common`)
- ❌ API response data (use React Query hooks)

---

## 6. Styling Guide

### Design Token System

All colors, spacing, radii, and font sizes come from shared tokens defined in `packages/ui/src/lib/tokens.ts` and re-exported by `@old-st/mobile-ui`:

```tsx
import { colors, spacing, radii, fontSizes } from '@old-st/mobile-ui';
// or for dark mode:
import { lightColors, darkColors } from '@old-st/mobile-ui';
```

### Token Reference

**Spacing:**
| Token | Value | Use for |
|---|---|---|
| `spacing.xs` | 4 | Tight gaps (icon margins) |
| `spacing.sm` | 8 | Small gaps (between badges) |
| `spacing.md` | 12 | Medium gaps (form fields) |
| `spacing.lg` | 16 | Standard padding (cards, screens) |
| `spacing.xl` | 24 | Section spacing |
| `spacing.xxl` | 32 | Large spacing (between sections) |

**Border Radii:**
| Token | Value | Use for |
|---|---|---|
| `radii.sm` | 6 | Small elements (badges) |
| `radii.md` | 8 | Buttons, inputs |
| `radii.lg` | 12 | Cards |
| `radii.xl` | 16 | Large cards, sheets |
| `radii.full` | 9999 | Circular elements (avatars) |

**Font Sizes:**
| Token | Value | Use for |
|---|---|---|
| `fontSizes.xs` | 12 | Captions, helper text |
| `fontSizes.sm` | 14 | Body text, labels |
| `fontSizes.md` | 16 | Standard text |
| `fontSizes.lg` | 18 | Subheadings |
| `fontSizes.xl` | 20 | Headings |
| `fontSizes.xxl` | 24 | Page titles |

**Semantic Colors (key ones):**
| Token | Light | Use for |
|---|---|---|
| `colors.background` | `#ffffff` | Screen backgrounds |
| `colors.foreground` | gray950 | Primary text |
| `colors.card` | `#ffffff` | Card backgrounds |
| `colors.primary` | gray900 | Primary buttons |
| `colors.primaryForeground` | gray50 | Text on primary buttons |
| `colors.secondary` | gray100 | Secondary buttons |
| `colors.destructive` | danger500 | Destructive actions |
| `colors.border` | gray200 | Borders, dividers |
| `colors.mutedForeground` | gray500 | Secondary text |
| `colors.brand` | brand600 | Brand accent |
| `colors.brandSubtle` | brand100 | Brand backgrounds |

### Style Rules

**1. Always use `StyleSheet.create()`:**

```tsx
// ✅ Good
const styles = StyleSheet.create({
  container: { padding: spacing.lg },
});

// ❌ Bad — inline objects create new references every render
<View style={{ padding: 16 }} />
```

**2. Use theme tokens — never hardcode colors:**

```tsx
// ✅ Good
container: { backgroundColor: colors.background }

// ❌ Bad
container: { backgroundColor: '#ffffff' }
```

**3. Inline styles only for truly dynamic values:**

```tsx
// ✅ Acceptable — dynamic opacity
<View style={[styles.card, { opacity: isDisabled ? 0.5 : 1 }]} />

// ❌ Bad — static style inline
<View style={{ padding: 16, backgroundColor: '#fff' }} />
```

**4. Styles go at the bottom of the file**, after the component.

**5. Use `@old-st/mobile-ui` primitives** — never raw `<Text>` or `<TouchableOpacity>`:

```tsx
// ✅ Good
import { Text, Button, Card } from '@old-st/mobile-ui';

// ❌ Bad
import { Text, TouchableOpacity } from 'react-native';
```

### Dark Mode

The token system supports dark mode via `lightColors` / `darkColors`:

```tsx
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from '@old-st/mobile-ui';

function MyScreen() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? darkColors : lightColors;

  return <View style={{ backgroundColor: palette.card }} />;
}
```

> Note: The existing primitives in `@old-st/mobile-ui` currently use the static `colors` import (= `lightColors`). When you implement dark mode, update primitives to accept a theme-aware palette.

---

## 7. Available UI Primitives (`@old-st/mobile-ui`)

These are shared components available out of the box. Always use these instead of building from scratch:

| Component | Import | Purpose |
|---|---|---|
| `Text` | `@old-st/mobile-ui` | Styled text with variants: `body`, `caption`, `heading`, `subheading`, `muted` |
| `Button` | `@old-st/mobile-ui` | Pressable button with variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `brand` + sizes: `default`, `sm`, `lg` + `loading` state |
| `Card` | `@old-st/mobile-ui` | Card container with `CardHeader`, `CardTitle`, `CardContent` subcomponents |
| `Badge` | `@old-st/mobile-ui` | Status badge with variants: `default`, `success`, `warning`, `destructive`, `secondary`, `outline`, `brand` |
| `Input` | `@old-st/mobile-ui` | Text input with label, error, helper text |
| `Avatar` | `@old-st/mobile-ui` | Circular avatar with sizes: `sm`, `md`, `lg` |
| `ListRow` | `@old-st/mobile-ui` | List item with leading/trailing slots + selected state |
| `Spinner` | `@old-st/mobile-ui` | Loading spinner with sizes: `sm`, `md`, `lg` |
| `EmptyState` | `@old-st/mobile-ui` | Empty list state with message |
| `Separator` | `@old-st/mobile-ui` | Horizontal line divider |
| `ErrorBoundary` | `@old-st/mobile-ui` | Class-based error boundary with retry |

### Adding New Primitives

New shared primitives go in `packages/mobile-ui/src/components/`. Follow the existing pattern:
1. Create the component file with types, component, and `StyleSheet.create()`
2. Export from `packages/mobile-ui/src/index.ts`
3. Use theme tokens — never hardcoded values

---

## 8. Auth Flow

### How Auth Works

```
App Launch
  → _layout.tsx mounts AuthProvider
  → AuthProvider rehydrates cached user from SecureStore (instant UI)
  → AuthProvider calls POST /auth/refresh-session (silent refresh)
  → If session valid: show (tabs)
  → If session expired: show auth/login
```

### Key Auth Hooks

| Hook | Purpose |
|---|---|
| `useAuth()` | Returns `{ user, isAuthenticated, isLoading, signIn, signOut }` |
| `useSignIn()` | Mutation: `POST /auth/sign-in` |
| `useCompleteNewPassword()` | Mutation: Cognito force-change |
| `useForgotPassword()` | Mutation: `POST /auth/forgot-password` |
| `useConfirmForgotPassword()` | Mutation: `POST /auth/confirm-forgot-password` |
| `useChangePassword()` | Mutation: `POST /auth/change-password` |
| `useSignOut()` | Mutation: clears token + cookie + cached user |

### Token Storage

- **Access token** — memory only (`accessTokenRef` in AuthProvider). Lost on app kill, restored via silent refresh.
- **Refresh token** — httpOnly cookie managed by RN's native HTTP cookie jar. Never in JS.
- **Cached user (MeResponse)** — `expo-secure-store` via `createSecureTokenStorage()` in `src/lib/secure-storage.ts`. Survives cold starts for instant UI.

### Protecting Routes

```tsx
// src/app/index.tsx — redirect based on auth state
import { Redirect } from 'expo-router';
import { useAuth } from '@old-st/client-common';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null; // splash screen is still visible
  if (isAuthenticated) return <Redirect href="/(tabs)" />;
  return <Redirect href="/auth/login" />;
}
```

---

## 9. Testing

### Test Framework

- **Runner:** Jest via `jest-expo` preset
- **Component testing:** React Native Testing Library (`@testing-library/react-native`)
- **Coverage threshold:** 70% (branches, functions, lines, statements)
- **Run tests:** `pnpm nx test mobile`

### Test File Location

Tests are co-located — `.spec.tsx` files live next to their source files (same convention as backend and webapp):

```
src/components/users/users-list.tsx        ← source
src/components/users/users-list.spec.tsx   ← test

src/lib/status-variants.ts                ← source
src/lib/status-variants.spec.ts           ← test
```

This keeps tests discoverable and makes it obvious when a file is missing its test.

### What to Test

| Layer | Test? | What to verify |
|---|---|---|
| Domain components (lists, cards) | **Yes** | Renders items, empty state, loading state, navigation on press |
| Screen files (thin orchestrators) | **Optional** | Only if they contain conditional logic |
| `src/lib/` utilities | **Yes** | Pure function behavior (status-variants, formatters) |
| `@old-st/mobile-ui` primitives | Tested in the package | Don't re-test in the app |
| `@old-st/client-common` hooks | Tested in the package | Don't re-test in the app |

### Test Template

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { UsersList } from './users-list';

const mockUsers = [
  { userId: '1', firstName: 'John', lastName: 'Doe', email: 'john@test.com', userStatus: 'ACTIVE', userRole: 'USER' },
];

describe('UsersList', () => {
  it('renders user items', () => {
    render(<UsersList users={mockUsers} isLoading={false} />);
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('shows loading state', () => {
    render(<UsersList users={[]} isLoading={true} />);
    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });

  it('shows empty state when no users', () => {
    render(<UsersList users={[]} isLoading={false} />);
    expect(screen.getByText('No users found')).toBeTruthy();
  });
});
```

### Jest Config Notes

- SVG files are mocked via `@nx/expo/plugins/jest/svg-mock`
- Workspace packages are mapped via `moduleNameMapper` in `jest.config.cts`
- `test-env-setup.ts` sets `NODE_ENV=test`
- `test-setup.ts` mocks `expo/src/winter/ImportMetaRegistry` and polyfills `structuredClone`

---

## 10. Build & Deploy

### Build Profiles (`eas.json`)

| Profile | `APP_ENV` | Distribution | Use case |
|---|---|---|---|
| `development` | `development` | Internal (simulator) | Local dev client |
| `preview` | `preview` | Internal (APK/simulator) | QA / stakeholder review |
| `production` | `production` | App Store / Play Store | Production release |

### OTA Updates (EAS Update)

EAS Update delivers JS bundle updates without a full native build. `runtimeVersion` uses `{ policy: 'appVersion' }` — OTA updates only deliver to binaries with the same `version` in `app.config.ts`.

**Bump `version` whenever a native dependency changes** (e.g. adding a new Expo module). OTA updates cannot change native code.

### Environment Variables

| Variable | Where set | Purpose |
|---|---|---|
| `APP_ENV` | `eas.json` → `env` block | Controls bundle ID suffix, app name |
| `EXPO_PUBLIC_API_*_URL` | EAS secrets or `.env` | API base URLs per domain |
| `EXPO_PUBLIC_SENTRY_DSN` | EAS secrets | Sentry error tracking |
| `EAS_PROJECT_ID` | EAS secrets | EAS project identifier |
| `EAS_UPDATE_URL` | EAS secrets | OTA update URL |
| `UNIVERSAL_LINK_DOMAIN_*` | EAS secrets | Deep linking domains per env |

### Commands

```bash
# Start dev server
pnpm nx serve mobile

# Run tests
pnpm nx test mobile

# EAS Build (requires EAS CLI)
eas build --profile development --platform ios
eas build --profile production --platform all

# EAS Update (OTA)
eas update --channel production --message "Fix: ..."
```

---

## 11. Deep Linking

The app supports two link types:

| Type | Format | Use case |
|---|---|---|
| Custom scheme | `oldst://path` | Push notifications, internal handoff |
| Universal Link | `https://{domain}/path` | Email, web, SMS (falls back to web) |

Expo Router maps URLs to file-based routes automatically. Configuration is in `app.config.ts` — see [DEEP_LINKING.md](../apps/mobile/DEEP_LINKING.md) for full setup instructions.

---

## 12. Error Handling

### Sentry (Crash Reporting)

- Initialized in `_layout.tsx` at app startup
- Root layout is wrapped with `Sentry.wrap()` when DSN is configured
- All JS errors and native crashes are reported automatically

### Error Boundaries

Use `<ErrorBoundary>` from `@old-st/mobile-ui` around screen trees:

```tsx
import { ErrorBoundary } from '@old-st/mobile-ui';
import * as Sentry from '@sentry/react-native';

<ErrorBoundary
  onError={(error) => Sentry.captureException(error)}
>
  <MyScreen />
</ErrorBoundary>
```

### API Error Handling

API errors are typed via `ApiError` from `@old-st/client-common`:

```tsx
import { ApiError } from '@old-st/client-common';

const mutation = useCreateUser();
mutation.mutate(input, {
  onError: (error) => {
    if (error instanceof ApiError) {
      if (error.isConflict) Alert.alert('User already exists');
      if (error.isValidationError) Alert.alert('Invalid input', error.message);
    }
  },
});
```

---

## 13. Best Practices Checklist

### Do

- ✅ Use `@old-st/mobile-ui` primitives for all interactive/styled elements
- ✅ Use `@old-st/client-common` hooks for all API communication
- ✅ Use `@old-st/contracts/{domain}` for types and enum constants
- ✅ Use `StyleSheet.create()` for all non-trivial styles
- ✅ Use theme tokens (`colors`, `spacing`, `radii`, `fontSizes`) — never hardcode
- ✅ Use `FlatList` for lists (not `ScrollView` + `map()`)
- ✅ Use `SafeAreaView` from `react-native-safe-area-context` for screen containers
- ✅ Use `useLocalSearchParams()` for route params in detail screens
- ✅ Use status enum constants (e.g. `UserStatusEnum.ACTIVE`) — never string literals
- ✅ Keep screens thin — delegate markup to `components/{domain}/`
- ✅ Put test files next to their source files (`.spec.tsx` co-located)
- ✅ Export components as named exports (not default) from component files

### Don't

- ❌ Import from `@old-st/contracts` root — use `@old-st/contracts/{domain}`
- ❌ Create mobile-only API clients — add to `@old-st/client-common` (shared with webapp)
- ❌ Call `fetch()` directly in components or screens
- ❌ Use `TouchableOpacity` / `TouchableHighlight` — use `Pressable` or `Button` from mobile-ui
- ❌ Use inline style objects for static styles
- ❌ Use `ScrollView` + `.map()` for dynamic lists
- ❌ Store refresh tokens in JS (they live in httpOnly cookies)
- ❌ Use `console.log` in production code — use Sentry for error reporting
- ❌ Use `any` — enable TypeScript strict mode and type everything
- ❌ Add state management libraries (Redux, Zustand) — React Query + useState is sufficient
- ❌ Skip the `key` prop on list items — always use a unique entity ID
- ❌ Use `expo-router`'s `Link` with hardcoded URLs — use type-safe `href` (typed routes enabled)

---

## 14. Quick Reference

### Adding a New Screen

1. Create the route file: `src/app/{path}.tsx`
2. Create domain components: `src/components/{domain}/`
3. Use existing hooks from `@old-st/client-common` or add new ones
4. If the screen is a tab: register in `src/app/(tabs)/_layout.tsx`
5. Add tests: `src/components/{domain}/*.spec.tsx`

### Adding a New Domain Component

1. Create `src/components/{domain}/{component-name}.tsx`
2. Define props interface, component, and `StyleSheet.create()`
3. Use `@old-st/mobile-ui` primitives + theme tokens
4. Add test file: `src/components/{domain}/{component-name}.spec.tsx`

### Adding a New Shared Primitive

1. Create `packages/mobile-ui/src/components/{name}.tsx`
2. Use theme tokens from `../lib/theme`
3. Export from `packages/mobile-ui/src/index.ts`
4. Use in the app: `import { Name } from '@old-st/mobile-ui'`

### Adding a New API Client / Hook

1. Add API client method in `packages/client-common/src/infrastructure/api-clients/`
2. Add React Query hook in `packages/client-common/src/hooks/`
3. Export from `packages/client-common/src/index.ts`
4. Use in mobile AND webapp: `import { useMyHook } from '@old-st/client-common'`
