# client-common Package Context

This file loads automatically for any file inside `packages/client-common/`. The package is the **single shared data-access layer** for the webapp (Next.js) and the mobile app (Expo). Anything that talks to a backend HTTP API lives here — never in `apps/webapp/` or `apps/mobile/`.

---

## What This Package Provides

| Subpath | Purpose |
|---|---|
| `infrastructure/config.ts` | `configureApi({ baseUrls })` — framework-agnostic per-domain base URL bootstrap. Called once from each app shell (webapp `layout.tsx`, mobile `_layout.tsx`). |
| `infrastructure/api-clients/` | One file per domain. Typed `fetch` wrappers using `apiRequest()` with mandatory `schema` (Zod) for response parsing. |
| `infrastructure/errors/api-error.ts` | `ApiError` class — typed counterpart of the backend `DomainExceptionFilter` shape. |
| `hooks/` | One file per domain. React Query hooks (queries + mutations + infinite). Shared by webapp and mobile. |
| `lib/query-client.ts` | Shared `QueryClient` config (staleTime, retry policy). |
| `lib/providers.tsx` | `<Providers>` wrapper — `QueryClientProvider` + `configureApi` bootstrap + `<AuthProvider>`. |
| `lib/optimistic-mutation.ts` | Helper for `onMutate` / `onError` / `onSettled` rollback pattern. |
| `lib/auth/` | `AuthProvider`, `useAuth`, `TokenStorage` adapter (mobile uses `expo-secure-store`, webapp uses cookies + memory). |

---

## Architectural Rules (Strictly Enforced)

1. **Never import from a UI framework.** No `next/*`, no `react-native`, no `expo-*`. The package must build for both Node and React Native bundlers. Auth token storage uses an injected `TokenStorage` adapter — never a direct `localStorage` / `SecureStore` reference.

2. **Every API client method MUST pass a Zod `schema`** to `apiRequest()`. Responses are validated at runtime. Never `return res.json() as T` — always `schema.parse(json)`.

3. **All requests use `credentials: 'include'`** so the browser sends the httpOnly refresh cookie. The base client sets this automatically; do not override.

4. **Import contract types from domain-scoped subpaths only.** Use `@old-st/contracts/{domain}` — never the bare `@old-st/contracts` root (Golden Rule #11).

5. **Query key conventions:**
   - List: `['{domain}', 'list', filters]`
   - Detail: `['{domain}', 'detail', id]`
   - Infinite list: `['{domain}', 'infinite', filters]`
   - Mutations invalidate the whole `['{domain}']` prefix unless they can targeted-invalidate.

6. **Pagination style is determined by the backend domain.** Cursor (`useUsersByStatusInfinite`) for DynamoDB domains, offset (`useOrders({ page, limit })`) for Prisma domains. Never mix in the same hook file.

7. **Mutations that change UI-visible state should pair with toast feedback in the consumer** — toasts are NOT triggered from the hook itself (the package is framework-agnostic).

8. **Optimistic updates use `optimisticMutation` or the documented hand-rolled `onMutate`/`onError`/`onSettled` pattern** — see the `webapp-optimistic-mutations` skill.

---

## Skills That Govern This Package

| Task | Skill |
|---|---|
| Adding a new domain's API client + hooks | `webapp-api-client-hooks` |
| Adding cursor-based infinite scroll | `webapp-cursor-infinite-scroll` |
| Adding optimistic mutations | `webapp-optimistic-mutations` |
| Adding file upload hooks | `webapp-file-upload-ux` |
| Mobile token storage / auth persistence | `mobile-secure-storage-auth` |
| Writing tests for clients/hooks | `write-client-common-tests` |

**Always read the relevant skill BEFORE editing this package.**

---

## Test Coverage Threshold

70% all metrics (configured in `packages/client-common/jest.config.ts`). API clients and hooks must always have tests; config and error class need at least one test each.
