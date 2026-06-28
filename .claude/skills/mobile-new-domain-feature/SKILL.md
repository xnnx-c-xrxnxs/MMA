---
name: mobile-new-domain-feature
description: End-to-end checklist for adding a new mobile feature that surfaces an existing backend capability. Use this when extending the Expo mobile app with a new screen, action, or domain component that connects to an existing API endpoint. Covers the full vertical slice from verifying hooks through screen, component, and navigation wiring.
---

# Adding a Mobile Feature (Existing Backend)

Use this skill when a backend endpoint already exists and you need to surface it in the mobile app. This covers the **mobile-specific** vertical slice. For adding a backend feature first, follow the `add-feature-existing-domain` skill.

Canonical references:
- Tab screen: `apps/mobile/src/app/(tabs)/users.tsx`
- Detail screen: `apps/mobile/src/app/users/[userId].tsx`
- List component: `apps/mobile/src/components/users/users-list.tsx`
- Status variants: `apps/mobile/src/lib/status-variants.ts`
- Shared hooks: `packages/client-common/src/hooks/use-users.ts`
- Shared API client: `packages/client-common/src/infrastructure/api-clients/user-api.client.ts`

---

## Required Information — Ask First

Before writing any code, confirm:

1. **Which domain?** (`users`, `orders`, `products`, or a new domain)
2. **What backend endpoint(s) exist?** (HTTP method + path)
3. **Is this an entirely new domain in mobile, or extending an existing mobile domain?**
4. **What type of feature?** Choose one or more:
   - **New list screen** (tab with filter + card list)
   - **New detail screen** (entity detail + actions)
   - **New action on an existing detail screen** (e.g. new button for a state transition)
   - **New field on an existing list/detail** (e.g. showing a new column)
   - **New create/edit form** (modal or separate screen)
5. **Are there new entity statuses to map?** (need badge variant update)

---

## Quick Decision: Which Steps to Follow

| Feature type | Steps |
|---|---|
| New domain (full: tab + detail + list) | All steps (1–7) |
| New action on existing detail screen | Steps 1, 2 (if new status), 5 only |
| New field on existing list | Steps 1, 3 only |
| New field on existing detail | Steps 1, 5 only |
| New create/edit form | Steps 1, 6 |
| New status values | Steps 1, 2, then update existing screens |

---

## Implementation Steps

### Step 1 — Verify Hooks + API Client Exist

The mobile app shares its data-access layer with the webapp via `@old-st/client-common`.

Check:
- **API client method** exists in `packages/client-common/src/infrastructure/api-clients/{domain}-api.client.ts`
- **React Query hook** exists in `packages/client-common/src/hooks/use-{domain}.ts`
- **Hook is exported** from `packages/client-common/src/hooks/index.ts`

If the hook or API method is missing, follow the **`webapp-api-client-hooks`** skill to add them. Once added, both the webapp and mobile app can use them immediately via `@old-st/client-common`.

**Key rule:** Never create mobile-only API clients or hooks. The `client-common` package is the single data-access layer shared across all frontends.

---

### Step 2 — Update Status-Variant Mapping (if new statuses)

File: `apps/mobile/src/lib/status-variants.ts`

If the feature introduces new entity statuses or a new entity type:
- Add a new `case` to the existing variant mapper, OR
- Add a new mapper function for the new entity type.

Follow the `mobile-new-screen` skill (Step 2) for the exact pattern.

**Rule:** Import enum constants from `@old-st/contracts/{domain}` — never hardcode strings.

---

### Step 3 — Update or Create List Component

File: `apps/mobile/src/components/{domain}/{domain}-list.tsx`

For **new fields**: add the field to the `{Entity}ListItem` component's Card markup.

For **new domain**: create the full list component following the `mobile-new-screen` skill (Step 3).

**Rules:**
- List items use `FlatList` with `Card` from `@old-st/mobile-ui`.
- Each item is wrapped in `Pressable` for tap navigation.
- Use `@old-st/contracts/{domain}` types for the entity response.

---

### Step 4 — Create or Update Tab Screen

File: `apps/mobile/src/app/(tabs)/{domain}.tsx`

For a **new domain**: create the tab screen following the `mobile-new-screen` skill (Step 4), then register in `(tabs)/_layout.tsx` (Step 6).

For **existing domain**: update the existing tab screen if the feature changes the list query, filter options, or header.

**Rules:**
- Tab screens are thin orchestrators — no card/item markup.
- Filter buttons use domain constants from `@old-st/contracts/{domain}`.
- Wrap in `SafeAreaView edges={['bottom']}`.

---

### Step 5 — Update or Create Detail Screen

File: `apps/mobile/src/app/{domain}/[{entity}Id].tsx`

For a **new action**: add the mutation hook import + conditional button to the Actions card.

```typescript
import { useNew{Action} } from '@old-st/client-common';

// Inside the component:
const newActionMutation = useNew{Action}();

// Inside the Actions card:
{{entity}.{entity}Status === {Entity}StatusEnum.{REQUIRED_STATUS} && (
  <Button
    variant="outline"
    onPress={() => newActionMutation.mutate({entity}Id)}
    loading={newActionMutation.isPending}
  >
    {Action Label}
  </Button>
)}
```

For a **new field**: add a field row to the info Card.

```typescript
<View style={styles.field}>
  <Text variant="caption">Field Label</Text>
  <Text>{entity}.newField</Text>
</View>
<Separator style={styles.separator} />
```

For a **new domain**: create the full detail screen following the `mobile-new-screen` skill (Step 5).

**Rules:**
- Status comparisons use `{Entity}StatusEnum.VALUE` — never string literals.
- Action buttons show loading via `loading={mutation.isPending}`.
- New fields follow the `caption + value + Separator` pattern.

---

### Step 6 — Create/Edit Form (if needed)

> **Preferred approach:** Use `react-hook-form` + `zodResolver` with the `Controller` pattern. See the `mobile-form-with-validation` skill for the full template including `KeyboardAvoidingView`, inline error display, and password fields. The `useState` pattern shown below is a simplified fallback for trivial forms with no validation.

For mobile forms, create a new screen file:

File: `apps/mobile/src/app/{domain}/create-{entity}.tsx`

```typescript
import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Text, Button, Input, Card, CardHeader, CardTitle, CardContent } from '@old-st/mobile-ui';
import { useCreate{Entity} } from '@old-st/client-common';
import type { Create{Entity}Input } from '@old-st/contracts/{domain}';

export default function Create{Entity}Screen() {
  const router = useRouter();
  const createMutation = useCreate{Entity}();
  const [form, setForm] = useState<Create{Entity}Input>({
    // default field values
  });

  const handleSubmit = () => {
    createMutation.mutate(form, {
      onSuccess: () => router.back(),
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Create {Entity}', headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card>
          <CardHeader>
            <CardTitle>New {Entity}</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.form}>
              {/* Input fields */}
              <Input
                placeholder="Field name"
                value={form.fieldName}
                onChangeText={(text) => setForm((f) => ({ ...f, fieldName: text }))}
              />
              {/* ... more fields */}
            </View>
            <View style={styles.buttons}>
              <Button onPress={handleSubmit} loading={createMutation.isPending}>
                Create
              </Button>
              <Button variant="outline" onPress={() => router.back()}>
                Cancel
              </Button>
            </View>
            {createMutation.isError && (
              <Text variant="caption" style={styles.error}>
                {createMutation.error.message}
              </Text>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16 },
  form: { gap: 12, marginBottom: 16 },
  buttons: { gap: 8 },
  error: { color: '#ef4444', marginTop: 8 },
});
```

**Rules:**
- Form screens use `ScrollView` (not `FlatList`).
- Navigate back on success via `router.back()`.
- Use `Input` from `@old-st/mobile-ui` for text fields.
- Form state uses `useState` with the contract input type.
- Error display uses `createMutation.isError` + `.error.message`.

---

### Step 7 — Register Navigation (if new screens)

**New tab:** Add `Tabs.Screen` entry in `apps/mobile/src/app/(tabs)/_layout.tsx`.

**New detail screen:** No registration needed — Expo Router picks up `app/{domain}/[{entity}Id].tsx` automatically.

**New form screen:** No registration needed — navigate via `router.push('/{domain}/create-{entity}')`.

---

## Environment Setup (New Domain Only)

If adding a completely new domain to mobile, add the API URL env var:

File: `apps/mobile/src/app/_layout.tsx`

Update `configureApi()`:
```typescript
configureApi({
  // ... existing URLs
  {domain}ApiUrl: process.env.EXPO_PUBLIC_API_{DOMAIN}_URL ?? 'http://localhost:{PORT}/api',
});
```

Also add `EXPO_PUBLIC_API_{DOMAIN}_URL` to the project's environment config (`.env`, EAS build secrets, etc.).

---

## Quick Reference: Which Files Are Affected

| Change type | Files |
|---|---|
| New domain (full mobile feature) | `app/(tabs)/{domain}.tsx`, `app/(tabs)/_layout.tsx`, `app/{domain}/[{entity}Id].tsx`, `components/{domain}/{domain}-list.tsx`, `lib/status-variants.ts`, `app/_layout.tsx` (configureApi) |
| New action on existing detail | `app/{domain}/[{entity}Id].tsx` only (+ hook if missing) |
| New field on existing list | `components/{domain}/{domain}-list.tsx` only |
| New field on existing detail | `app/{domain}/[{entity}Id].tsx` only |
| New status value | `lib/status-variants.ts` + affected screens |
| New create form | `app/{domain}/create-{entity}.tsx` (new file) |

---

## Shared Layer Dependency Chart

```
Mobile Screen (apps/mobile/src/app/)
  → Domain Component (apps/mobile/src/components/{domain}/)
    → Status Variants (apps/mobile/src/lib/status-variants.ts)
    → React Query Hooks (packages/client-common/src/hooks/)        ← SHARED with webapp
      → API Client (packages/client-common/src/infrastructure/)    ← SHARED with webapp
        → Contracts (packages/contracts/{domain}/src/)             ← SHARED with all
          → Backend REST API
```

The mobile app and webapp share **everything below the component layer**: hooks, API clients, contracts, and backend. Only the screen and component layers are platform-specific.

---

## Common Mistakes to Avoid

- **Creating mobile-only API clients or hooks** — always use `@old-st/client-common`. The data-access layer is shared.
- **Hardcoding status strings** — use `{Entity}StatusEnum.VALUE` from contracts.
- **Using `ScrollView` + `map()` for lists** — use `FlatList` for virtualization.
- **Forgetting `export default function`** — Expo Router requires default exports.
- **Forgetting to register a new tab** — check `(tabs)/_layout.tsx`.
- **Forgetting `SafeAreaView`** — tab screens need safe area wrapping.
- **Inline styles for non-trivial styling** — use `StyleSheet.create()`.
- **Importing from `@old-st/ui` in mobile** — use `@old-st/mobile-ui` for React Native components.
