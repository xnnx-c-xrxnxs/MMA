---
name: mobile-navigation-patterns
description: Configure Expo Router navigation for the mobile app — tab layout, stack navigator, auth vs protected routing, modal presentation, deep link routing, and typed route params. Use this when adding new route groups, modifying the tab bar, or troubleshooting navigation issues like redirect loops or missing screens.
---

# Mobile Navigation Patterns (Expo Router)

The mobile app uses **Expo Router v4** with file-based routing. Every `.tsx` file under `apps/mobile/src/app/` becomes a route. Navigation structure is defined by `_layout.tsx` files at each level.

Canonical references:
- Root layout: `apps/mobile/src/app/_layout.tsx`
- Tab layout: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Dynamic route: `apps/mobile/src/app/{domain}/[{entity}Id].tsx`
- Deep linking: `apps/mobile/DEEP_LINKING.md`

---

## Required Information — Ask First

1. **What navigation change?** (new tab, new stack screen, new route group, modal, auth guard)
2. **Is this a tab screen or a pushed screen?** (tabs appear in bottom bar; pushed screens slide in from the right)
3. **Does this screen require authentication?** (protected screens live inside `(tabs)` or other protected groups)
4. **Are route params needed?** (e.g. `[userId]`, `[orderId]`)

---

## Route Hierarchy

```
apps/mobile/src/app/
  _layout.tsx              ← Root: Stack with (auth) + (tabs) groups
  index.tsx                ← Redirect → /(tabs)
  (auth)/
    _layout.tsx            ← Auth Stack (unauthenticated only)
    login.tsx
    forgot-password.tsx
    confirm-reset.tsx
    new-password.tsx
  (tabs)/
    _layout.tsx            ← Tab navigator (protected — requires auth)
    index.tsx              ← Dashboard tab
    users.tsx              ← Users tab
    products.tsx           ← Products tab
    orders.tsx             ← Orders tab
  users/
    [userId].tsx           ← User detail (pushed from users tab)
  products/
    [productId].tsx        ← Product detail
  orders/
    [orderId].tsx          ← Order detail
  {domain}/
    create-{entity}.tsx    ← Create form (pushed or modal)
  settings.tsx             ← Settings (pushed from tab)
  profile.tsx              ← Profile (pushed from tab)
```

**Key concepts:**
- **Route groups** `(auth)` and `(tabs)` — parentheses mean the segment doesn't appear in the URL. `/(auth)/login` renders `login.tsx` inside the auth stack.
- **Dynamic segments** `[userId]` — populated via `useLocalSearchParams<{ userId: string }>()`.
- **Screens outside groups** (`settings.tsx`, `profile.tsx`, `users/[userId].tsx`) — pushed onto the root Stack on top of the current tab.

---

## Pattern 1 — Root Stack Layout

File: `apps/mobile/src/app/_layout.tsx`

The root layout is always a `<Stack>`. It hosts all top-level route groups and standalone screens.

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(auth)" />
  <Stack.Screen name="(tabs)" />
  {/* Detail screens inherit from root Stack — headerShown defaults per screen */}
</Stack>
```

**Rules:**
- `headerShown: false` at root level — each group/screen controls its own header.
- Route groups (`(auth)`, `(tabs)`) must be declared as `<Stack.Screen name="(groupName)" />`.
- Screens outside groups (e.g. `users/[userId].tsx`) are picked up automatically by the root Stack — they push on top.
- The root layout wraps everything in providers: `SafeAreaProvider` → `QueryClientProvider` → `AuthProvider`.

---

## Pattern 2 — Tab Navigator

File: `apps/mobile/src/app/(tabs)/_layout.tsx`

```tsx
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
        tabBarActiveTintColor: '#1a1a2e',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ focused }) => <TabIcon label="👥" focused={focused} />,
        }}
      />
      {/* Add more tabs here */}
    </Tabs>
  );
}
```

**Rules for adding a new tab:**
1. Create the screen file: `apps/mobile/src/app/(tabs)/{domain}.tsx` (must be `export default function`).
2. Add `<Tabs.Screen name="{domain}" options={{ title: '...', tabBarIcon: ... }} />` to the layout.
3. Tab screen order in the layout determines the visual order in the tab bar.
4. Tab screens must be **thin orchestrators** — wire hooks + render list components. No heavy markup.

---

## Pattern 3 — Auth vs Protected Routing

Auth guard lives in the root layout via a `useProtectedRoute()` hook. See the `mobile-auth-screens` skill for the full implementation.

**How it works:**
- `useSegments()` tells you which route group the user is currently in.
- If `user` is `null` and not in `(auth)` → `router.replace('/(auth)/login')`.
- If `user` exists and in `(auth)` → `router.replace('/(tabs)')`.
- Wait for `isLoading` before redirecting to avoid flash.

**Rules:**
- Auth guard runs ONLY in the root layout — never in individual screens.
- Use `router.replace()` for auth redirects — prevents back-navigation to login after sign-in.
- The `(auth)` group has no tab bar — it's a plain Stack.
- The `(tabs)` group is the "protected" zone — only accessible when authenticated.

---

## Pattern 4 — Detail Screen (Dynamic Route)

File: `apps/mobile/src/app/{domain}/[{entity}Id].tsx`

```tsx
import { useLocalSearchParams, Stack } from 'expo-router';

export default function EntityDetailScreen() {
  const { entityId } = useLocalSearchParams<{ entityId: string }>();
  // ...
  return (
    <>
      <Stack.Screen options={{ title: 'Entity Details', headerShown: true }} />
      {/* Screen content */}
    </>
  );
}
```

**Rules:**
- Dynamic route files use bracket syntax: `[entityId].tsx`.
- Read params with `useLocalSearchParams<{ entityId: string }>()` — always provide the type.
- Set `headerShown: true` and a dynamic `title` via `<Stack.Screen options={...} />`.
- Detail screens push onto the root Stack — the tab bar remains visible underneath.

---

## Pattern 5 — Modal Presentation

For screens that should slide up as a modal rather than push from the right:

```tsx
// In the root _layout.tsx or the parent layout:
<Stack.Screen
  name="create-entity"
  options={{
    presentation: 'modal',
    headerShown: true,
    title: 'Create Entity',
  }}
/>
```

Or set it from within the screen:

```tsx
// In apps/mobile/src/app/{domain}/create-{entity}.tsx:
<Stack.Screen
  options={{
    presentation: 'modal',
    headerShown: true,
    title: 'Create Entity',
  }}
/>
```

**Rules:**
- Use `presentation: 'modal'` for create forms, filters, and settings that feel like overlays.
- Modal screens on iOS get a swipe-to-dismiss gesture automatically.
- On Android, modals slide up from the bottom.
- The header back button becomes an "X" (close) in modal presentation.

---

## Pattern 6 — Passing Route Params

**Passing params when navigating:**

```tsx
const router = useRouter();

// String path (simple):
router.push(`/users/${userId}`);

// Object path (with non-path params):
router.push({
  pathname: '/(auth)/confirm-reset',
  params: { email: 'user@test.com' },
});
```

**Reading params in the target screen:**

```tsx
const { userId } = useLocalSearchParams<{ userId: string }>();
const { email } = useLocalSearchParams<{ email: string }>();
```

**Rules:**
- Path params (`[userId]`) are defined by the file name and populated automatically.
- Non-path params (query-style) are passed via the `params` object — they appear in `useLocalSearchParams` the same way.
- Always provide a TypeScript generic to `useLocalSearchParams` for type safety.
- Params are always strings — parse numbers or JSON if needed.

---

## Pattern 7 — Header Actions

Add buttons to the navigation header from within a screen:

```tsx
import { Stack } from 'expo-router';
import { Pressable } from 'react-native';
import { Text } from '@mma/mobile-ui';

export default function UsersScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Users',
          headerRight: () => (
            <Pressable onPress={() => router.push('/users/create-user')}>
              <Text style={{ color: '#3b82f6', fontWeight: '600' }}>+ New</Text>
            </Pressable>
          ),
        }}
      />
      {/* Screen content */}
    </>
  );
}
```

**Note:** For tab screens, use `<Tabs.Screen options={{ headerRight: ... }} />` inside the screen, not the layout.

---

## Common Mistakes

| Bug | Fix |
|---|---|
| Screen not appearing | Ensure the file is directly under `app/` or a route group. Files in `components/` are not routes. |
| Tab screen missing from tab bar | Add `<Tabs.Screen name="filename" />` to `(tabs)/_layout.tsx`. The `name` must match the file name without `.tsx`. |
| Back button returns to wrong screen | Use `router.replace()` for auth redirects, `router.push()` for normal navigation. |
| Infinite redirect loop | Check `useProtectedRoute` — ensure `isLoading` guard prevents redirecting before auth state is known. |
| Dynamic route shows "not found" | File must be named `[paramName].tsx` with brackets. Param name must match what you pass. |
| `useLocalSearchParams` returns `undefined` | Param name in the generic must match the file name bracket: `[userId].tsx` → `useLocalSearchParams<{ userId: string }>()`. |
| Header overlaps safe area | Use `SafeAreaView` with appropriate `edges` or set `headerShown: true` on the Stack.Screen. |
| Modal doesn't dismiss on swipe (Android) | `presentation: 'modal'` swipe-to-dismiss is iOS only. Add an explicit close button for Android. |
| Route group name appears in URL | Use parentheses: `(auth)` not `auth`. Parenthesized names are removed from the path. |
| Screen renders but tab bar disappears | If the screen file is outside `(tabs)/`, it pushes on the root Stack (above tabs). Move it inside `(tabs)/` if it should keep the tab bar visible. |

---

## Adding a New Route Group

When you need a logical grouping beyond `(auth)` and `(tabs)`:

1. Create `apps/mobile/src/app/(groupName)/_layout.tsx` with a `Stack` or `Tabs`.
2. Add screen files inside the group.
3. Register the group in the parent layout: `<Stack.Screen name="(groupName)" />`.

Common use cases:
- `(onboarding)` — multi-step first-launch flow
- `(settings)` — settings sub-pages with their own back stack
- `(admin)` — admin-only screens gated by role

---

## Deep Link Integration

Expo Router maps URLs to file routes automatically. When a deep link arrives:

1. Custom scheme: `oldst://users/u-123` → matches `app/users/[userId].tsx`
2. Universal Link: `https://app.example.com/users/u-123` → same match

**Rules:**
- No manual linking config needed — Expo Router derives it from the file structure.
- Route params from deep links arrive via `useLocalSearchParams` like normal navigation.
- See the `mobile-deep-linking` skill for custom scheme and Universal Link configuration.
- See `apps/mobile/DEEP_LINKING.md` for the full URL → route map.
