# Mobile Template — Implementation Plan

> **Purpose:** Step-by-step build plan for the base mobile template screens and components. This covers what ships in the template itself — domain-specific screens (users list, product detail, etc.) are generated per-project via the `/mobile-feature` prompt and live in `examples/`.

---

## Current State (What Already Exists)

### App Shell (apps/mobile/src/)

| File | Status | Notes |
|---|---|---|
| `app/_layout.tsx` | ✅ Done | SafeAreaProvider → QueryClient → AuthProvider, Sentry, configureApi, SplashScreen |
| `app/index.tsx` | ✅ Done | Redirect to `/(tabs)` |
| `app/(tabs)/_layout.tsx` | ⚠️ Placeholder | Dashboard tab only, hardcoded colors (not theme tokens) |
| `app/(tabs)/index.tsx` | ⚠️ Placeholder | Static cards, hardcoded colors |
| `lib/secure-storage.ts` | ✅ Done | TokenStorage adapter for expo-secure-store |
| `app/(auth)/` | ❌ Missing | No auth screens |
| `components/` | ❌ Missing | No domain or shared components |
| `lib/` (beyond secure-storage) | ❌ Missing | No status-variants, no helpers |

### Shared Packages (Already Built)

| Package | Assets |
|---|---|
| `@mma/mobile-ui` | 11 primitives: Avatar, Badge, Button, Card (+ Header/Title/Content), EmptyState, ErrorBoundary, Input, ListRow, Separator, Spinner, Text |
| `@mma/client-common` | Auth hooks: useSignIn, useCompleteNewPassword, useRefreshSession, useForgotPassword, useConfirmForgotPassword, useChangePassword, useSignOut, useCurrentUser. Also: useFileUpload, optimisticMutation, AuthProvider, useAuth, configureApi |
| `@mma/contracts/auth` | Zod schemas: signInRequestSchema (discriminated union), forgotPasswordRequestSchema, confirmForgotPasswordRequestSchema, newPasswordRequestSchema, changePasswordRequestSchema, meResponseSchema |
| Design tokens | `packages/ui/src/lib/tokens.ts` → re-exported by `packages/mobile-ui/src/lib/theme.ts` (colors, spacing, radii, fontSizes) |

### Webapp Parity Reference (What the Webapp Already Ships)

The mobile template should mirror the webapp's base feature set:

| Webapp Screen | Mobile Equivalent | Status |
|---|---|---|
| `auth/login/page.tsx` | `(auth)/login.tsx` | ❌ To build |
| `auth/forgot-password/page.tsx` | `(auth)/forgot-password.tsx` + `(auth)/confirm-reset.tsx` | ❌ To build |
| `auth/new-password/page.tsx` | `(auth)/new-password.tsx` | ❌ To build |
| `(protected)/layout.tsx` (auth guard) | Root layout auth guard | ❌ To build |
| `(protected)/page.tsx` (dashboard) | `(tabs)/index.tsx` | ⚠️ Polish |
| `(protected)/change-password/page.tsx` | `change-password.tsx` | ❌ To build |
| Sidebar (sign out, user info) | Profile tab | ❌ To build |

---

## Plan Scrutiny — What Was Cut and Why

Your draft had solid structure. Here's what was adjusted to fit this specific template:

### Kept (Core Template Value)

| Item | Reason |
|---|---|
| Auth screens (Login, Forgot Password, Confirm Reset, New Password) | Direct webapp parity. Hooks + contracts already exist. |
| Dashboard / Home | Already scaffolded, needs polish. |
| Profile screen | Webapp equivalent = sidebar user info + sign out. |
| Change Password | Webapp already has this. Hook exists. |
| Settings | Minimal version (theme, sign out, app version). |
| Empty states | `EmptyState` primitive already exists in mobile-ui. |
| Error boundaries | `ErrorBoundary` primitive already exists in mobile-ui. |
| Loading states | `Spinner` primitive already exists in mobile-ui. |
| List + Detail screen templates | These are the **domain patterns** — they ship in `examples/` and are generated via `/mobile-feature` prompt. |

### Moved to Core Plan

| Item | Phase | Reason |
|---|---|---|
| **Onboarding** | Phase 6 | Universal mobile first-launch pattern. The content is app-specific, but the UX pattern (swipeable pages + dots + skip/next + first-launch check) is completely templatable. |

### Moved to Future Implementation Phases

These features are common in modern apps and valuable, but not required for the core template to function. Fully specified in the **Future Implementation Phases** section below, prioritized by universality and value.

| Item | Future Phase | Priority |
|---|---|---|
| **Dark Mode** | F1 | Tier 1 — System dark mode is standard on iOS/Android |
| **Notification Center** | F2 | Tier 1 — Universal for apps that communicate with users |
| **Biometric Auth** | F3 | Tier 1 — Face ID / Touch ID expected by users |
| **Search Shell** | F4 | Tier 2 — Universal pattern, domain-specific content |
| **Bottom Sheet** | F5 | Tier 2 — Replaces web modals/dropdowns on mobile |
| **Offline Support** | F6 | Tier 2 — Critical for field apps |
| **i18n / Localization** | F7 | Tier 3 — Essential for international apps |
| **Swipe Actions** | F8 | Tier 3 — Nice UX for list items |
| **In-App Browser** | F9 | Tier 3 — T&C, help docs, external links |
| **Media Viewer** | F10 | Tier 3 — File attachment viewing |

### Not Planned (Wrong Pattern)

These were considered and rejected for architectural reasons, not priority:

| Item | Reason |
|---|---|
| **Register / Sign Up** | Backend uses Cognito with admin-created users. No self-registration endpoint. Add when backend supports it. |
| **OTP Verification** | Cognito handles challenges via `NEW_PASSWORD_REQUIRED` flow. Confirm-reset screen covers code entry. |
| **Permission Requests Screen** | Wrong UX pattern — request at point-of-use (camera when uploading, location when mapping), not a standalone screen. |
| **Help & Support / FAQ / About** | Static content trivially different per team. Not worth templating. |
| **Breadcrumbs / FAB** | Web patterns (breadcrumbs) and app-specific (FAB). Wrong for mobile. |
| **Grid System** | React Native uses flexbox natively. No abstraction needed. |
| **Analytics Hooks** | Per-project choice (Mixpanel, Amplitude, PostHog). Not templatable. |

### Deferred to Primitives-on-Demand

Built via `mobile-ui-primitive` skill when a screen needs them — no pre-building:

| Primitive | Typical Trigger | Skill |
|---|---|---|
| `Switch` / `Toggle` | Phase 4 (Settings — dark mode toggle) | `mobile-ui-primitive` |
| `Toast` | Phase 0 (Auth error feedback) | `mobile-ui-primitive` |
| `Select` / `Picker` | Future domain screens (filters) | `mobile-ui-primitive` |
| `Dialog` / `AlertDialog` | Sign out confirmation, delete actions | `mobile-ui-primitive` |
| `DatePicker` / `TimePicker` | Date fields in forms | `mobile-ui-primitive` |
| `Radio` / `RadioGroup` | Single-select options in forms | `mobile-ui-primitive` |
| `Checkbox` | Multi-select, T&C acceptance | `mobile-ui-primitive` |
| `Chips` / `Tags` | Filter selections, multi-select display | `mobile-ui-primitive` |
| `ProgressBar` | Upload progress, multi-step flows | `mobile-ui-primitive` |

---

## Implementation Phases

### Phase 0 — New Primitives (Pre-requisites)

Build the mobile-ui primitives that Phase 1+ screens will need.

| # | Deliverable | Details |
|---|---|---|
| 0a | `Toast` primitive in `@mma/mobile-ui` | Lightweight toast for success/error feedback. Used by all auth screens for error messages and by mutation flows for success confirmation. The webapp uses `sonner` — mobile needs its own implementation using `Animated` API. Provide `toast.success()`, `toast.error()`, `toast.info()` API. |
| 0b | `ToastProvider` in `@mma/mobile-ui` | Context provider mounted in root `_layout.tsx` (same pattern as webapp's `<Toaster>` in `layout.tsx`). |

**Skill:** `mobile-ui-primitive`
**Tests:** `packages/mobile-ui/src/components/toast.spec.tsx`

> **Why Toast first?** Every form screen (login, forgot-password, change-password) needs error/success feedback. Without Toast, we'd either use `Alert.alert()` (bad UX, blocks the thread) or skip feedback entirely (violates Golden Rule #23c equivalent for mobile).

---

### Phase 1 — Auth Screens

The highest-priority phase. Every other screen depends on the auth guard.

| # | File | Type | Description | Skill |
|---|---|---|---|---|
| 1a | `src/app/(auth)/_layout.tsx` | Layout | Stack navigator for auth group, headerless, light background | `mobile-navigation-patterns` |
| 1b | `src/app/(auth)/login.tsx` | Screen | Email + password form → `useSignIn()` → discriminated union: SUCCESS → `/(tabs)`, NEW_PASSWORD_REQUIRED → `/new-password?email=&session=` | `mobile-auth-screens`, `mobile-form-with-validation` |
| 1c | `src/app/(auth)/forgot-password.tsx` | Screen | Email field → `useForgotPassword()` → navigate to `confirm-reset?email=` | `mobile-auth-screens`, `mobile-form-with-validation` |
| 1d | `src/app/(auth)/confirm-reset.tsx` | Screen | Code + new password + confirm password → `useConfirmForgotPassword()` → navigate to login with success toast | `mobile-auth-screens`, `mobile-form-with-validation` |
| 1e | `src/app/(auth)/new-password.tsx` | Screen | Force-change flow. Reads `email` + `session` from route params → `useCompleteNewPassword()` → navigate to `/(tabs)` | `mobile-auth-screens`, `mobile-form-with-validation` |
| 1f | `src/components/auth/password-field.tsx` | Component | Reusable secure text entry with visibility toggle. Props: `control`, `name`, `label`, `placeholder`, `textContentType`. Used across login, confirm-reset, new-password, change-password | `mobile-form-with-validation` |
| 1g | `src/components/auth/auth-form-container.tsx` | Component | Shared wrapper: `KeyboardAvoidingView` → `ScrollView` → `Card` with title/subtitle + branding. All auth screens use this for consistent layout | — |
| 1h | Update `src/app/_layout.tsx` | Edit | Add `(auth)` Stack.Screen. Add `useProtectedRoute()` hook: reads `useAuth()` → if not authenticated and not on `(auth)` segment → redirect to `/(auth)/login`. If authenticated and on `(auth)` → redirect to `/(tabs)` | `mobile-navigation-patterns` |

**Dependencies:** Phase 0 (Toast for error feedback)
**Contracts used:** `signInRequestSchema`, `forgotPasswordRequestSchema`, `confirmForgotPasswordRequestSchema`, `newPasswordRequestSchema` from `@mma/contracts/auth`
**Hooks used:** `useSignIn`, `useForgotPassword`, `useConfirmForgotPassword`, `useCompleteNewPassword`, `useAuth` from `@mma/client-common`

**Tests:**
- `src/app/(auth)/login.spec.tsx` — submit credentials, SUCCESS response, NEW_PASSWORD_REQUIRED response, validation errors, loading state
- `src/app/(auth)/forgot-password.spec.tsx` — submit email, navigation to confirm-reset
- `src/app/(auth)/confirm-reset.spec.tsx` — submit code + passwords, password mismatch error
- `src/app/(auth)/new-password.spec.tsx` — force-change flow, missing params redirect
- `src/components/auth/password-field.spec.tsx` — toggle visibility, props forwarding
- `src/components/auth/auth-form-container.spec.tsx` — renders title, children

---

### Phase 2 — Tab Structure + Dashboard Polish

| # | File | Type | Description | Skill |
|---|---|---|---|---|
| 2a | Update `src/app/(tabs)/_layout.tsx` | Edit | Replace hardcoded colors with theme tokens from `@mma/mobile-ui`. Clean tab bar styling. Keep Dashboard tab + placeholder comments for domain tabs (same pattern, better code) | `mobile-navigation-patterns` |
| 2b | Update `src/app/(tabs)/index.tsx` | Edit | Polish dashboard: use theme tokens, show user greeting from `useCurrentUser()`, summary cards as pressable (navigate to domain tabs when added), replace hardcoded `#f8fafc` with `colors.background` | `mobile-new-screen` |

**Dependencies:** Phase 1 (auth guard — dashboard should only render for authenticated users)
**Hooks used:** `useCurrentUser` from `@mma/client-common`

**Tests:**
- `src/app/(tabs)/index.spec.tsx` — renders greeting with user name, renders summary cards

---

### Phase 3 — Profile + Change Password

| # | File | Type | Description | Skill |
|---|---|---|---|---|
| 3a | `src/app/(tabs)/profile.tsx` | Screen | Tab screen showing current user info (avatar, name, email, role badge), menu items for Change Password and Settings, Sign Out button at bottom. Uses `useCurrentUser()` + `useSignOut()` | `mobile-new-screen` |
| 3b | `src/components/profile/user-info-card.tsx` | Component | Card with Avatar + user name + email + role Badge. Reusable if detail screens need user info | — |
| 3c | `src/components/profile/menu-item.tsx` | Component | Pressable row: icon (emoji/text) + label + chevron `›`. Used in profile and settings for navigation | — |
| 3d | `src/app/change-password.tsx` | Screen | Stack screen (not a tab). Current password + new password + confirm password form → `useChangePassword()` → success toast + `router.back()` | `mobile-form-with-validation` |
| 3e | Update `src/app/(tabs)/_layout.tsx` | Edit | Add Profile tab with 👤 icon | `mobile-navigation-patterns` |
| 3f | Update `src/app/_layout.tsx` | Edit | Add `change-password` as a Stack.Screen (modal presentation) | `mobile-navigation-patterns` |

**Dependencies:** Phase 1 (auth), Phase 0 (Toast for success feedback)
**Contracts used:** `changePasswordRequestSchema` from `@mma/contracts/auth`
**Hooks used:** `useCurrentUser`, `useChangePassword`, `useSignOut`, `useAuth` from `@mma/client-common`

**Tests:**
- `src/app/(tabs)/profile.spec.tsx` — renders user info, sign out calls mutation, navigates to change-password and settings
- `src/components/profile/user-info-card.spec.tsx` — renders avatar with initials, name, email, role badge
- `src/components/profile/menu-item.spec.tsx` — renders label, fires onPress
- `src/app/change-password.spec.tsx` — submits form, password mismatch error, success navigation

---

### Phase 4 — Settings Screen

| # | File | Type | Description | Skill |
|---|---|---|---|---|
| 4a | `Switch` primitive in `@mma/mobile-ui` | Primitive | Wraps RN `Switch` with theme tokens. Props: `checked`, `onCheckedChange`, `disabled`, `label` | `mobile-ui-primitive` |
| 4b | `src/app/settings.tsx` | Screen | Stack screen. Sections: **Preferences** (dark mode toggle via Switch — future, disabled for now), **Account** (Change Password link → reuses menu-item), **About** (app version from `Constants.expoConfig.version`, environment from `extra.appEnv`) | `mobile-new-screen` |
| 4c | Update `src/app/_layout.tsx` | Edit | Add `settings` as a Stack.Screen | `mobile-navigation-patterns` |

**Dependencies:** Phase 3 (profile screen navigates to settings, menu-item component)

**Tests:**
- `packages/mobile-ui/src/components/switch.spec.tsx` — toggle fires callback, disabled state
- `src/app/settings.spec.tsx` — renders sections, navigates to change-password, shows app version

---

### Phase 5 — Shared Utility Components

Components that emerged as patterns during Phases 1–4 but are useful for future domain screens.

| # | File | Type | Description |
|---|---|---|---|
| 5a | `src/components/shared/screen-container.tsx` | Component | `SafeAreaView` + `ScrollView` with consistent padding and background color from theme tokens. Replaces the repeated `SafeAreaView edges={['bottom']} + View style={styles.container}` pattern across all screens |
| 5b | `src/components/shared/loading-screen.tsx` | Component | Full-screen centered `Spinner` with optional message text. Used when a screen's primary query is loading |
| 5c | `src/components/shared/section-header.tsx` | Component | Section title + optional subtitle for grouping content (used in Settings, future domain detail screens) |
| 5d | `src/lib/status-variants.ts` | Utility | Empty barrel file with doc comment explaining the pattern. Actual status mappings are added per-domain by `/mobile-feature` prompt. See [examples/apps/mobile/src/lib/status-variants.ts](examples/apps/mobile/src/lib/status-variants.ts) for reference |

**Tests:**
- `src/components/shared/screen-container.spec.tsx` — renders children with safe area
- `src/components/shared/loading-screen.spec.tsx` — renders spinner, optional message
- `src/components/shared/section-header.spec.tsx` — renders title, optional subtitle

---

### Phase 6 — Onboarding

First-launch experience. The UX pattern (swipeable pages + dots + skip/next + AsyncStorage first-launch check) is universal in mobile apps. Ships with 3 generic placeholder pages that teams customize with their own content and illustrations.

| # | File | Type | Description | Skill |
|---|---|---|---|---|
| 6a | `src/app/(onboarding)/_layout.tsx` | Layout | Stack navigator for onboarding group, headerless, no back gesture | `mobile-navigation-patterns` |
| 6b | `src/app/(onboarding)/index.tsx` | Screen | Horizontal `FlatList` carousel: 3 pages with dot indicators, Skip + Next buttons. Final page "Get Started" → marks complete → navigates to `/(auth)/login` | `mobile-new-screen` |
| 6c | `src/components/onboarding/onboarding-page.tsx` | Component | Single page: icon/illustration area + title + description. Props: `icon`, `title`, `description` | — |
| 6d | `src/components/onboarding/page-indicator.tsx` | Component | Horizontal dot row. Props: `totalPages`, `currentPage`. Active dot uses `primary` token, inactive uses `muted` | — |
| 6e | `src/lib/onboarding-storage.ts` | Utility | `hasCompletedOnboarding()` / `markOnboardingComplete()` — AsyncStorage wrapper with `@onboarding_complete` key | — |
| 6f | Update `src/app/_layout.tsx` | Edit | Check `hasCompletedOnboarding()` on mount. If false and not already on `(onboarding)` → route to `/(onboarding)`. If true → existing auth guard logic | `mobile-navigation-patterns` |

**Dependencies:** Phase 1 (after onboarding completes, user lands on auth login)
**No contracts or hooks needed** — purely local UI + AsyncStorage

**Tests:**
- `src/app/(onboarding)/index.spec.tsx` — swipes between pages, skip navigates to auth, get started marks complete + navigates
- `src/components/onboarding/onboarding-page.spec.tsx` — renders icon, title, description
- `src/components/onboarding/page-indicator.spec.tsx` — renders correct number of dots, highlights active page

---

## Phase Dependency Graph

```
Phase 0 (Toast primitive)
  └── Phase 1 (Auth screens)
        ├── Phase 2 (Dashboard polish)
        ├── Phase 3 (Profile + Change Password)
        │     └── Phase 4 (Settings)
        └── Phase 6 (Onboarding)
  Phase 5 (Shared components) — can run in parallel after Phase 2
```

---

## File Inventory (Complete)

### New Files (42 total)

| Phase | File | Type |
|---|---|---|
| 0 | `packages/mobile-ui/src/components/toast.tsx` | Primitive |
| 0 | `packages/mobile-ui/src/components/toast.spec.tsx` | Test |
| 1 | `apps/mobile/src/app/(auth)/_layout.tsx` | Layout |
| 1 | `apps/mobile/src/app/(auth)/login.tsx` | Screen |
| 1 | `apps/mobile/src/app/(auth)/login.spec.tsx` | Test |
| 1 | `apps/mobile/src/app/(auth)/forgot-password.tsx` | Screen |
| 1 | `apps/mobile/src/app/(auth)/forgot-password.spec.tsx` | Test |
| 1 | `apps/mobile/src/app/(auth)/confirm-reset.tsx` | Screen |
| 1 | `apps/mobile/src/app/(auth)/confirm-reset.spec.tsx` | Test |
| 1 | `apps/mobile/src/app/(auth)/new-password.tsx` | Screen |
| 1 | `apps/mobile/src/app/(auth)/new-password.spec.tsx` | Test |
| 1 | `apps/mobile/src/components/auth/password-field.tsx` | Component |
| 1 | `apps/mobile/src/components/auth/password-field.spec.tsx` | Test |
| 1 | `apps/mobile/src/components/auth/auth-form-container.tsx` | Component |
| 1 | `apps/mobile/src/components/auth/auth-form-container.spec.tsx` | Test |
| 3 | `apps/mobile/src/app/(tabs)/profile.tsx` | Screen |
| 3 | `apps/mobile/src/app/(tabs)/profile.spec.tsx` | Test |
| 3 | `apps/mobile/src/components/profile/user-info-card.tsx` | Component |
| 3 | `apps/mobile/src/components/profile/user-info-card.spec.tsx` | Test |
| 3 | `apps/mobile/src/components/profile/menu-item.tsx` | Component |
| 3 | `apps/mobile/src/components/profile/menu-item.spec.tsx` | Test |
| 3 | `apps/mobile/src/app/change-password.tsx` | Screen |
| 3 | `apps/mobile/src/app/change-password.spec.tsx` | Test |
| 4 | `packages/mobile-ui/src/components/switch.tsx` | Primitive |
| 4 | `packages/mobile-ui/src/components/switch.spec.tsx` | Test |
| 4 | `apps/mobile/src/app/settings.tsx` | Screen |
| 4 | `apps/mobile/src/app/settings.spec.tsx` | Test |
| 5 | `apps/mobile/src/components/shared/screen-container.tsx` | Component |
| 5 | `apps/mobile/src/components/shared/screen-container.spec.tsx` | Test |
| 5 | `apps/mobile/src/components/shared/loading-screen.tsx` | Component |
| 5 | `apps/mobile/src/components/shared/loading-screen.spec.tsx` | Test |
| 5 | `apps/mobile/src/components/shared/section-header.tsx` | Component |
| 5 | `apps/mobile/src/components/shared/section-header.spec.tsx` | Test |
| 5 | `apps/mobile/src/lib/status-variants.ts` | Utility |
| 6 | `apps/mobile/src/app/(onboarding)/_layout.tsx` | Layout |
| 6 | `apps/mobile/src/app/(onboarding)/index.tsx` | Screen |
| 6 | `apps/mobile/src/app/(onboarding)/index.spec.tsx` | Test |
| 6 | `apps/mobile/src/components/onboarding/onboarding-page.tsx` | Component |
| 6 | `apps/mobile/src/components/onboarding/onboarding-page.spec.tsx` | Test |
| 6 | `apps/mobile/src/components/onboarding/page-indicator.tsx` | Component |
| 6 | `apps/mobile/src/components/onboarding/page-indicator.spec.tsx` | Test |
| 6 | `apps/mobile/src/lib/onboarding-storage.ts` | Utility |

### Edited Files (5 total)

| Phase | File | Changes |
|---|---|---|
| 1 | `apps/mobile/src/app/_layout.tsx` | Add `(auth)` Stack.Screen, add `useProtectedRoute()` auth guard |
| 2 | `apps/mobile/src/app/(tabs)/_layout.tsx` | Theme tokens, add Profile tab (Phase 3) |
| 2 | `apps/mobile/src/app/(tabs)/index.tsx` | Theme tokens, user greeting, pressable cards |
| 0 | `packages/mobile-ui/src/index.ts` | Export Toast, ToastProvider, Switch |
| 6 | `apps/mobile/src/app/_layout.tsx` | Add onboarding check, `(onboarding)` Stack.Screen |

---

## Acceptance Criteria (Per Phase)

### Phase 0
- [ ] `Toast.success()`, `Toast.error()`, `Toast.info()` render and auto-dismiss
- [ ] `<ToastProvider>` mounts in root layout
- [ ] Tests pass

### Phase 1
- [ ] Cold start → splash → login screen (not dashboard)
- [ ] Login with valid credentials → dashboard
- [ ] Login with NEW_PASSWORD_REQUIRED → new-password screen → dashboard
- [ ] Login with wrong password → error toast
- [ ] Forgot password → enter email → enter code + new password → login
- [ ] Auth guard: unauthenticated user hitting `/(tabs)` → redirect to login
- [ ] Auth guard: authenticated user hitting `/(auth)` → redirect to dashboard
- [ ] All auth screens use `KeyboardAvoidingView`
- [ ] Tests pass, `nx test mobile` green

### Phase 2
- [ ] Dashboard shows user greeting ("Welcome, Alice")
- [ ] No hardcoded colors — all from theme tokens
- [ ] Summary cards render

### Phase 3
- [ ] Profile tab shows user avatar, name, email, role badge
- [ ] Sign Out button → clears session → redirects to login
- [ ] Change Password → submits → success toast → navigates back
- [ ] Change Password → wrong current password → error toast
- [ ] Tests pass

### Phase 4
- [ ] Settings shows app version and environment
- [ ] Dark mode toggle visible but disabled (placeholder for future)
- [ ] Navigation back to profile works
- [ ] Tests pass

### Phase 5
- [ ] Shared components render correctly in isolation
- [ ] `status-variants.ts` exists as empty barrel with doc comment

### Phase 6
- [ ] First launch → onboarding carousel (3 pages)
- [ ] Skip button → navigates to auth login
- [ ] "Get Started" on last page → marks complete + navigates to auth login
- [ ] Subsequent launches skip onboarding
- [ ] Dot indicators track current page
- [ ] Tests pass

---

## Future Implementation Phases (Post-Core)

These phases extend the template with features common in modern mobile apps. Prioritized by how universal the feature is and how much value it adds. Each is independent — teams pick the ones relevant to their app. Implementation order is a recommendation, not a requirement.

### Tier 1 — High Priority (Standard in Modern Apps)

#### Future Phase F1 — Dark Mode

**Why:** iOS and Android both have system-level dark mode. Users expect apps to respect it. The template's token infrastructure (`lightColors`/`darkColors`) already exists — this phase activates it.

| Deliverable | Details |
|---|---|
| `ThemeProvider` context | Wraps app in `_layout.tsx`. Reads `useColorScheme()` for system preference, allows manual override. Stores choice in AsyncStorage |
| Enable Settings toggle | Activate the disabled Switch from Phase 4 to toggle light/dark/system |
| Verify all screens | All screens already use design tokens — verify no hardcoded colors remain |

**Primitives needed:** None (tokens already exist in `mobile-ui/src/lib/theme.ts`)
**Skills:** `fe-design-tokens`
**New files:** `src/lib/theme-provider.tsx`, `src/lib/theme-provider.spec.tsx`
**Edited files:** `_layout.tsx`, `settings.tsx`

---

#### Future Phase F2 — Notification Center

**Why:** Near-universal in any app that communicates with users. The screen pattern (list, unread badge, mark-as-read, empty state) is completely templatable even without the backend wired up.

| Deliverable | Details |
|---|---|
| `(tabs)/notifications.tsx` | Tab screen with notification list |
| `notification-item.tsx` | Row: icon + title + body preview + relative timestamp + unread dot |
| `notification-list.tsx` | FlatList with pull-to-refresh + empty state |
| Tab badge | Unread count badge on Notifications tab icon |
| Mark as read | Tap individual + header action for mark-all |

**Primitives needed:** None (ListRow, Badge, EmptyState already exist)
**Skills:** `mobile-push-notifications`, `mobile-new-screen`
**Depends on:** `notification-domain` backend for real data. Ships as empty shell with `EmptyState` ("No notifications yet") until backend is built.
**New files:** `src/app/(tabs)/notifications.tsx`, `src/components/notifications/notification-item.tsx`, `src/components/notifications/notification-list.tsx` + specs

---

#### Future Phase F3 — Biometric Auth

**Why:** Face ID / Touch ID is a standard security feature. Users expect it for app unlock and sensitive action re-authentication.

| Deliverable | Details |
|---|---|
| `expo-local-authentication` | Biometric prompt for app unlock |
| Settings opt-in | Toggle in Settings screen (uses Switch from Phase 4) |
| App state listener | Auto-lock on background → biometric prompt on foreground |
| Sensitive action re-auth | Re-authenticate before change password, delete account |

**Skills:** `mobile-secure-storage-auth`
**New files:** `src/lib/biometric-auth.ts`, `src/lib/biometric-auth.spec.tsx`
**Edited files:** `settings.tsx`, `_layout.tsx`

---

### Tier 2 — Medium Priority (Common Pattern, Domain-Dependent)

#### Future Phase F4 — Search Shell

**Why:** Search is a universal mobile pattern, but WHAT you search is domain-specific. The template ships the UI shell (search bar, recent searches, results skeleton). Domain-specific queries are wired per-project via `/mobile-feature`.

| Deliverable | Details |
|---|---|
| `SearchBar` primitive in `@mma/mobile-ui` | Text input with search icon, clear button, cancel. Controlled component |
| `src/app/search.tsx` | Search screen: SearchBar + recent searches (AsyncStorage, capped at 10) + results section |
| Recent searches | AsyncStorage-backed list, rendered as `ListRow` items |

**Primitives needed:** `SearchBar` in `@mma/mobile-ui`
**Skills:** `mobile-ui-primitive`, `mobile-new-screen`
**New files:** `packages/mobile-ui/src/components/search-bar.tsx`, `src/app/search.tsx`, `src/lib/recent-searches.ts` + specs

---

#### Future Phase F5 — Bottom Sheet

**Why:** Replaces web-style modals and dropdowns. Standard mobile UX for action menus, filter panels, and quick forms.

| Deliverable | Details |
|---|---|
| `BottomSheet` primitive in `@mma/mobile-ui` | Wraps `@gorhom/bottom-sheet` or custom `Animated`. Snap points, drag to dismiss, backdrop |
| Handle component | Drag indicator bar |

**Skills:** `mobile-ui-primitive`
**New files:** `packages/mobile-ui/src/components/bottom-sheet.tsx` + spec

---

#### Future Phase F6 — Offline Support

**Why:** Critical for field apps or unreliable networks. Less urgent for always-connected admin tools, but the pattern is reusable.

| Deliverable | Details |
|---|---|
| React Query persistence | `persistQueryClient` + AsyncStorage/MMKV for offline cache |
| Mutation queue | Optimistic mutations execute when back online |
| `NetworkStatusBanner` | "No internet connection" banner at top of screen |
| Config | `src/lib/offline-config.ts` — which queries to persist, TTL |

**Skills:** `native-data-fetching`
**New files:** `src/lib/offline-config.ts`, `src/components/shared/network-status-banner.tsx` + specs

---

### Tier 3 — Lower Priority (Valuable but Situational)

#### Future Phase F7 — i18n / Localization

**Why:** Essential for international apps, overkill for single-market products.

| Deliverable | Details |
|---|---|
| `expo-localization` + `i18next` | Locale detection + translation framework |
| Translation files | `src/i18n/{locale}.json` structure |
| Language switcher | In Settings screen |
| RTL support | `I18nManager` for right-to-left layouts |

**Note:** Large scope. Better implemented as a dedicated skill (`mobile-localization`).

---

#### Future Phase F8 — Swipe Actions

**Why:** Nice UX enhancement for list items. Common in email/messaging/admin apps.

| Deliverable | Details |
|---|---|
| `SwipeableRow` primitive in `@mma/mobile-ui` | Wraps `react-native-gesture-handler` Swipeable |
| Left/right action slots | Delete, archive, mark as read |

**Pairs with:** Domain list screens generated by `/mobile-feature`

---

#### Future Phase F9 — In-App Browser / WebView

**Why:** Useful for Terms & Conditions, help docs, external links without leaving the app.

| Deliverable | Details |
|---|---|
| `expo-web-browser` | Full browser for external links |
| `WebViewScreen` component | Embedded webview with loading indicator + nav controls |

---

#### Future Phase F10 — Media Viewer

**Why:** Useful for apps with file attachments (photos, documents).

| Deliverable | Details |
|---|---|
| Image viewer | Zoom/pan with `react-native-image-viewing` or similar |
| Document preview | PDF viewing capability |
| Pairs with | `useFileUpload` from `@mma/client-common` |

---

## What This Plan Does NOT Cover (By Design)

These are handled by other mechanisms in the template:

| Concern | Mechanism |
|---|---|
| Domain screens (users list, product detail, etc.) | `/mobile-feature` prompt → generates per-domain |
| Domain components (users-list, orders-list) | `/mobile-feature` prompt → generates per-domain |
| Push notifications (backend) | `mobile-push-notifications` skill + `add-push-notifications` prompt |
| Deep linking | `mobile-deep-linking` skill |
| EAS Build/Update config | `mobile-eas-build-update` skill |
| CD pipeline | `mobile-cd-pipeline` skill + `mobile-release` prompt |
| Self-registration | Not in scope — Cognito uses admin-created users |

---

## Skills Loaded Per Phase

| Phase | Skills |
|---|---|
| 0 | `mobile-ui-primitive` |
| 1 | `mobile-auth-screens`, `mobile-form-with-validation`, `mobile-navigation-patterns` |
| 2 | `mobile-navigation-patterns`, `mobile-new-screen` |
| 3 | `mobile-new-screen`, `mobile-form-with-validation`, `mobile-navigation-patterns` |
| 4 | `mobile-ui-primitive`, `mobile-new-screen`, `mobile-navigation-patterns` |
| 5 | `write-mobile-tests` |
| 6 | `mobile-new-screen`, `mobile-navigation-patterns` |

---

## Estimated Scope (Core Phases 0–6)

| Metric | Count |
|---|---|
| New screens | 9 (4 auth + dashboard polish + profile + change-password + settings + onboarding) |
| New components | 10 (password-field, auth-form-container, user-info-card, menu-item, screen-container, loading-screen, section-header, onboarding-page, page-indicator, onboarding-storage) |
| New primitives | 2 (Toast + Switch) |
| New test files | ~19 |
| Edited files | 5 |
| Total new files | ~42 |
| Future phases | 10 (F1–F10, prioritized by tier) |
