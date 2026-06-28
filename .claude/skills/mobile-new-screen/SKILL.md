---
name: mobile-new-screen
description: Add a new screen and domain components to the Expo (React Native) mobile app. Use this when creating a new tab screen, detail screen, domain list, create/edit form, or status-variant mapping in apps/mobile/. Covers the Expo Router file-based routing pattern, domain-scoped component structure, tab navigation, and status badge wiring.
---

# Adding a Mobile Screen + Domain Components

**See also:**
- `mobile-form-with-validation` — for forms with validation (react-hook-form + Zod `Controller` pattern).
- `mobile-navigation-patterns` — for navigation wiring (tabs, stacks, auth guard, modals, route params).
- `mobile-auth-screens` — for auth-specific screens (login, forgot-password, confirm-reset, new-password).
- `write-mobile-tests` — for test patterns (co-located `.spec.tsx` next to source file).

Canonical references:
- Tab screen: `apps/mobile/src/app/(tabs)/users.tsx`
- Detail screen: `apps/mobile/src/app/users/[userId].tsx`
- Domain list component: `apps/mobile/src/components/users/users-list.tsx`
- Status variants: `apps/mobile/src/lib/status-variants.ts`
- Tab layout: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Root layout: `apps/mobile/src/app/_layout.tsx`

---

## Required Information — Ask First

Before writing any code, confirm:

1. **Which domain?** (`users`, `orders`, `products`, or a new domain)
2. **What entity is displayed?** (e.g. `User`, `Order`, `Product`)
3. **What list/query hook exists?** (e.g. `useUsersByStatus`) — if none, follow the `webapp-api-client-hooks` skill first (hooks are shared via `@mma/client-common`)
4. **What fields should the list card show?** (from the entity response type)
5. **Does the entity have statuses?** (if yes, need status-variant mapping + status filter)
6. **What actions are available on the detail screen?** (e.g. activate, deactivate, delete — driven by entity status)
7. **Does it need a create form?** (modal or dedicated screen)
8. **Should this screen appear as a tab?** (bottom tab navigator)

---

## Ordered Implementation Steps

Work through these steps **in order** — screens depend on components, which depend on hooks.

---

### Step 1 — Verify Hooks + API Client Exist

Before building UI, confirm that the React Query hooks and API client methods exist in `packages/client-common/`.

- **Hooks file:** `packages/client-common/src/hooks/use-{domain}.ts`
- **API client file:** `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts`
- **Barrel export:** hooks must be exported from `packages/client-common/src/hooks/index.ts`

If any are missing, follow the **`webapp-api-client-hooks`** skill first. Hooks and API clients are shared between webapp and mobile — you do NOT create separate mobile-only data-access code.

---

### Step 2 — Status-Variant Mapping (if entity has statuses)

File: `apps/mobile/src/lib/status-variants.ts`

Add a variant mapper function for the new entity:

```typescript
import { {Entity}StatusEnum } from '@mma/contracts/{domain}';

export function {entity}StatusVariant(status: string): BadgeVariant {
  switch (status) {
    case {Entity}StatusEnum.ACTIVE: return 'success';
    case {Entity}StatusEnum.PENDING: return 'warning';
    case {Entity}StatusEnum.INACTIVE: return 'secondary';
    case {Entity}StatusEnum.DELETED: return 'destructive';
    default: return 'outline';
  }
}
```

**Rules:**
- Import the status enum from `@mma/contracts/{domain}` — never hardcode string literals.
- The function name follows `{entity}StatusVariant` (camelCase).
- Return type is `BadgeVariant` (from `@mma/mobile-ui`).
- Always include a `default: return 'outline'` fallback.
- Map semantics match webapp: `success` = positive/active, `warning` = pending/needs-attention, `secondary` = neutral/inactive, `destructive` = error/deleted/cancelled.

---

### Step 2a — Status Label Helper (if entity has statuses)

The per-domain `format{Entity}Status()` helper lives in `packages/client-common/src/lib/status-labels/{domain}.ts` and is **shared with the webapp** — if the webapp already added it, mobile reuses it as-is. If not, follow the **`webapp-new-page`** skill § Step 2a to add it.

Mobile imports it the same way: `import { format{Entity}Status } from '@mma/client-common';` and wraps every JSX status render: `{format{Entity}Status({entity}.status)}`. Enforced by the `no-raw-status-in-jsx` lint check (Golden Rule #22a).

---

### Step 3 — Domain List Component

File: `apps/mobile/src/components/{domain}/{domain}-list.tsx`

The list component receives the data array and renders a `FlatList` with `Card` items.

```typescript
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Badge, Card, CardContent, Separator } from '@mma/mobile-ui';
import { format{Entity}Status } from '@mma/client-common';
import { {entity}StatusVariant } from '../../lib/status-variants';
import type { {Entity}Response } from '@mma/contracts/{domain}';

interface {Entity}ListItemProps {
  {entity}: {Entity}Response;
}

function {Entity}ListItem({ {entity} }: {Entity}ListItemProps) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/{domain}/{${entity}.{entity}Id}`)}>
      <Card style={styles.card}>
        <CardContent style={styles.cardContent}>
          <View style={styles.row}>
            <View style={styles.info}>
              <Text variant="subheading">{/* primary field */}</Text>
              <Text variant="muted">{/* secondary field */}</Text>
            </View>
            <View style={styles.badges}>
              <Badge variant={{entity}StatusVariant({entity}.{entity}Status)}>
                {{entity}.{entity}Status}
              </Badge>
            </View>
          </View>
          <Separator style={styles.separator} />
          <View style={styles.meta}>
            <Text variant="caption">{/* metadata field */}</Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}

interface {Entity}sListProps {
  {entity}s: {Entity}Response[];
  isLoading: boolean;
  onLoadMore?: () => void;
}

export function {Entity}sList({ {entity}s, isLoading, onLoadMore }: {Entity}sListProps) {
  if (isLoading && {entity}s.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={{entity}s}
      keyExtractor={(item) => item.{entity}Id}
      renderItem={({ item }) => <{Entity}ListItem {entity}={item} />}
      contentContainerStyle={styles.list}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text variant="muted" style={styles.empty}>No {entity}s found</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 8 },
  card: { marginBottom: 0 },
  cardContent: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1, gap: 2 },
  badges: { marginLeft: 8 },
  separator: { marginVertical: 8 },
  meta: { flexDirection: 'row', gap: 8 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 32 },
});
```

**Rules:**
- Use `FlatList` for list rendering — never `ScrollView` + `map()` (breaks virtualization).
- Each list item is wrapped in `Pressable` for tap navigation via `useRouter().push()`.
- Card items use `@mma/mobile-ui` primitives (Card, CardContent, Badge, Text, Separator).
- `keyExtractor` uses the entity's primary ID field.
- Loading state: `ActivityIndicator` centered in a flex container.
- Empty state: `ListEmptyComponent` with `Text variant="muted"`.
- Use `StyleSheet.create()` — never inline objects (except one-off style overrides).
- The `{Entity}ListItem` is a private function component in the same file — not exported.

---

### Step 4 — Tab Screen (List Screen)

File: `apps/mobile/src/app/(tabs)/{domain}.tsx`

The tab screen is a **thin orchestrator** — it manages filter state and wires the list component.

```typescript
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button } from '@mma/mobile-ui';
import { use{Entity}sByStatus } from '@mma/client-common';
import { {ENTITY}_STATUSES } from '@mma/contracts/{domain}';
import { {Entity}sList } from '../../components/{domain}/{domain}-list';

const statuses = ['ALL', ...{ENTITY}_STATUSES];

export default function {Entity}sScreen() {
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const queryStatus = selectedStatus === 'ALL' ? undefined : selectedStatus;
  const { data, isLoading } = use{Entity}sByStatus({ {entity}Status: queryStatus });
  const {entity}s = data?.data ?? [];

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text variant="heading">{Entity}s</Text>
      </View>
      <View style={styles.filters}>
        {statuses.map((status) => (
          <Button
            key={status}
            variant={selectedStatus === status ? 'default' : 'outline'}
            size="sm"
            onPress={() => setSelectedStatus(status)}
          >
            {status}
          </Button>
        ))}
      </View>
      <{Entity}sList {entity}s={{entity}s} isLoading={isLoading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
});
```

**Rules:**
- `export default function` — Expo Router requires default exports for screens.
- Tab screens wrap content in `SafeAreaView` with `edges={['bottom']}`.
- Filter buttons use `Button` from `@mma/mobile-ui` with `variant` toggling.
- Status filter constants come from `@mma/contracts/{domain}` — never hardcoded.
- The screen renders header text, filter bar, and the list component — no card/item markup.
- Styling uses `StyleSheet.create()` at the bottom of the file.

---

### Step 5 — Detail Screen (Dynamic Route)

File: `apps/mobile/src/app/{domain}/[{entity}Id].tsx`

The detail screen uses Expo Router's dynamic route segment to get the entity ID.

```typescript
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Text, Badge, Card, CardHeader, CardTitle, CardContent, Button, Separator } from '@mma/mobile-ui';
import { use{Entity}, use{Action1}{Entity}, use{Action2}{Entity}, format{Entity}Status } from '@mma/client-common';
import { {entity}StatusVariant } from '../../lib/status-variants';
import { {Entity}StatusEnum } from '@mma/contracts/{domain}';

export default function {Entity}DetailScreen() {
  const { {entity}Id } = useLocalSearchParams<{ {entity}Id: string }>();
  const { data: {entity}, isLoading } = use{Entity}({entity}Id);
  const action1Mutation = use{Action1}{Entity}();
  const action2Mutation = use{Action2}{Entity}();

  if (isLoading || !{entity}) {
    return (
      <>
        <Stack.Screen options={{ title: '{Entity} Details', headerShown: true }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: /* dynamic title */, headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Entity info card */}
        <Card>
          <CardHeader>
            <View style={styles.titleRow}>
              <CardTitle>{/* primary field */}</CardTitle>
              <Badge variant={{entity}StatusVariant({entity}.{entity}Status)}>
                {format{Entity}Status({entity}.{entity}Status)}
              </Badge>
            </View>
          </CardHeader>
          <CardContent>
            {/* Field rows with Text variant="caption" labels */}
            <View style={styles.field}>
              <Text variant="caption">Field Label</Text>
              <Text>{/* field value */}</Text>
            </View>
            <Separator style={styles.separator} />
            {/* ... more fields */}
          </CardContent>
        </Card>

        {/* Actions card */}
        <Card style={styles.actionsCard}>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.actions}>
              {{entity}.{entity}Status === {Entity}StatusEnum.PENDING && (
                <Button
                  variant="default"
                  onPress={() => action1Mutation.mutate({entity}Id)}
                  loading={action1Mutation.isPending}
                >
                  {Action1 Label}
                </Button>
              )}
              {{entity}.{entity}Status === {Entity}StatusEnum.ACTIVE && (
                <Button
                  variant="outline"
                  onPress={() => action2Mutation.mutate({entity}Id)}
                  loading={action2Mutation.isPending}
                >
                  {Action2 Label}
                </Button>
              )}
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  field: { gap: 2 },
  separator: { marginVertical: 12 },
  actionsCard: { marginTop: 0 },
  actions: { gap: 8 },
});
```

**Rules:**
- Use `useLocalSearchParams<{ {entity}Id: string }>()` to extract the dynamic route parameter.
- Set the header title dynamically via `Stack.Screen options={{ title: ..., headerShown: true }}`.
- Loading state: render `Stack.Screen` first (so header shows), then `ActivityIndicator`.
- Detail content uses `ScrollView` (not `FlatList`) since the content is not a homogeneous list.
- Info fields follow the `caption label + value` pattern with `Separator` between groups.
- Actions are rendered in a separate `Card` below the info card.
- Action buttons are conditionally rendered based on entity status using `{Entity}StatusEnum` — never string literals.
- Mutation buttons pass `loading={mutation.isPending}` to show spinner state.

---

### Step 6 — Tab Navigation Registration

File: `apps/mobile/src/app/(tabs)/_layout.tsx`

Add the new domain as a tab screen:

```typescript
<Tabs.Screen
  name="{domain}"
  options={{
    title: '{Entity}s',
    tabBarIcon: ({ focused }) => <TabIcon label="📋" focused={focused} />,
  }}
/>
```

**Rules:**
- `name` matches the filename in `(tabs)/` without the extension (e.g. `users`, `products`, `orders`).
- Place the new tab after existing tabs, before any settings/utility tabs.
- Use an emoji icon via the `TabIcon` helper — consistent with existing tab pattern.

---

### Step 7 — Stack Route Registration (for detail screens)

File: `apps/mobile/src/app/_layout.tsx`

The root layout's `<Stack>` automatically picks up new folders under `app/`. No manual registration is needed for detail screens — Expo Router uses file-based routing.

Verify the detail screen file is at: `apps/mobile/src/app/{domain}/[{entity}Id].tsx`

The `[{entity}Id]` bracket syntax creates a dynamic route segment automatically.

---

## Quick Reference: Which Files Are Affected

| Change type | Files |
|---|---|
| New domain (tab + detail) | `app/(tabs)/{domain}.tsx`, `app/{domain}/[{entity}Id].tsx`, `components/{domain}/{domain}-list.tsx`, `lib/status-variants.ts`, `app/(tabs)/_layout.tsx` |
| New list field/column | `components/{domain}/{domain}-list.tsx` only |
| New action on detail | `app/{domain}/[{entity}Id].tsx` + possibly a new mutation hook |
| New status value | `lib/status-variants.ts` (add case to variant mapper) |
| New form screen | `app/{domain}/create-{entity}.tsx` (new file) |

---

## Common Mistakes to Avoid

- **Putting list item markup in the tab screen** — the screen is a thin orchestrator. Card/item markup lives in the domain list component.
- **Using `ScrollView` + `map()` for lists** — always use `FlatList` for virtualized scrolling.
- **Using raw `View`/`Text` instead of `@mma/mobile-ui` primitives** — use Card, Badge, Button, Text variants.
- **Hardcoding status strings** — always use `{Entity}StatusEnum.VALUE` from `@mma/contracts/{domain}`.
- **Calling `fetch()` directly** — always use React Query hooks from `@mma/client-common`.
- **Inline style objects** — use `StyleSheet.create()` at the bottom of the file for all non-trivial styles.
- **Forgetting `export default function`** — Expo Router requires default exports for screens.
- **Forgetting `SafeAreaView`** — tab screens must wrap in `SafeAreaView` with appropriate `edges`.
- **Forgetting to register the tab** — check `(tabs)/_layout.tsx` after creating a new tab screen.
- **Mixing pagination styles** — DynamoDB domains use cursor-based; Prisma domains use offset-based. Check which your domain uses.
