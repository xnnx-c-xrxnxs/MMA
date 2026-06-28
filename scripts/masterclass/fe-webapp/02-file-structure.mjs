// Module 02 — File Structure: New vs Old
// Side-by-side comparison of directory layouts and what changed.

export default {
    id: '02-file-structure',
    level: 1,
    complexityLabel: 'L1 · Structure',
    domain: 'Architecture',
    title: 'File Structure — New vs Old',
    introShort: 'Route groups, feature-scoped components, and shared packages replace scattered module folders.',
    intro: 'The old template mixed all components into a shared library, used a flat route structure, and owned its own auth/layout wrappers per app. The new template uses Next.js App Router route groups, domain-scoped components co-located with pages, and a dedicated shared UI + data-access layer across web and mobile.',

    specTitle: 'Structure · Old vs New',
    specBodyHtml: `
    <p><strong>Old template (nx-template-v2):</strong></p>
    <ul>
      <li>Components live in <code>libs/frontend/components-web/</code> — a shared lib used by <em>all</em> apps.</li>
      <li>Data access in <code>libs/frontend/data-access/src/api/</code> — Axios classes with inheritance.</li>
      <li>Pages at <code>apps/web-app/src/app/(authenticated-routes)/dashboard/</code>.</li>
      <li>Auth guard is a <code>&lt;ProtectedRoute&gt;</code> wrapper component inside a layout.</li>
      <li>Styles: global SCSS in <code>libs/frontend/components-web/src/styles/</code>.</li>
    </ul>
    <p><strong>New template (mma):</strong></p>
    <ul>
      <li>Domain components co-locate with features in <code>apps/webapp/src/components/{domain}/</code>.</li>
      <li>Shared UI primitives in <code>packages/ui/src/components/</code> (web) and <code>packages/mobile-ui/</code> (mobile).</li>
      <li>Shared hooks + API clients in <code>packages/client-common/src/</code> — used by webapp <em>and</em> mobile.</li>
      <li>Auth guard is a <code>useAuth()</code> hook check in the <code>(protected)/layout.tsx</code> route group.</li>
      <li>Styles: Tailwind v4 utilities + design tokens in <code>packages/design-tokens/</code>.</li>
    </ul>
    <p>The key structural shift: domain knowledge stays with the app; primitives + data-access are shared packages.</p>
  `,

    entityFilename: 'file-structure.comparison.ts',
    entityCode: `// ════════════════════════════════════════════════════════════════════
//  OLD TEMPLATE — nx-template-v2
// ════════════════════════════════════════════════════════════════════
//
//  apps/
//    web-app/
//      src/
//        app/
//          (authenticated-routes)/
//            layout.tsx              ← wraps ProtectedRoute + WithSidebar
//            dashboard/page.tsx
//            settings/page.tsx
//          auth/
//            login/page.tsx
//          layout.tsx                ← bare <html><body>{children}</body></html>
//          global.scss               ← global styles imported in layout
//        components/
//          global/
//            client-provider/        ← QueryClient setup per-app
//            protected-route/        ← auth wrapper component
//          layouts/
//            with-sidebar/           ← sidebar layout component
//          modules/                  ← domain "modules" (mixed UI + fetch)
//        config/
//          metadata.ts
//        types/
//          layout.ts
//
//  libs/
//    frontend/
//      components-web/               ← ALL shared components (web only)
//        src/
//          data-display/
//          form-controls/
//          icons/
//          navigation/
//          styles/                   ← global .scss files
//      data-access/
//        src/
//          api/
//            axiosConfig.ts          ← base class (Axios + interceptors)
//            auth.ts                 ← extends AxiosConfig
//            user.ts                 ← extends AxiosConfig
//          config/
//            env.ts                  ← async env loader (runtime fetch)
//          hooks/                    ← React Query hooks
//          state-management/         ← Zustand / Context stores
//
// ════════════════════════════════════════════════════════════════════
//  NEW TEMPLATE — mma
// ════════════════════════════════════════════════════════════════════
//
//  apps/
//    webapp/
//      src/
//        app/
//          layout.tsx                ← root: ThemeProvider + Providers + Toaster
//          globals.css               ← @import tokens.css; Tailwind v4 directives
//          (protected)/
//            layout.tsx              ← client: useAuth() guard + <Sidebar>
//            page.tsx                ← dashboard redirect
//          auth/
//            login/page.tsx
//          global-error.tsx          ← App Router error boundary (root)
//          not-found.tsx
//        components/
//          layout/
//            sidebar.tsx             ← shared layout only; no domain logic
//            header.tsx
//          theme-provider.tsx        ← next-themes wrapper
//          theme-toggle.tsx
//        features/                   ← (reserved for cross-domain features)
//        lib/
//          status-variants.ts        ← badge variant maps (uses domain enums)
//        test-setup.ts
//
//  packages/
//    ui/                             ← @mma/ui — web primitives (shadcn-style)
//      src/
//        components/
//          data-display/             ← Badge, Card, Table, Skeleton …
//          feedback/                 ← Toast (Sonner), Alert …
//          form-controls/            ← Button, Input, Select, Form …
//          layout/                   ← Separator, Sheet, Dialog …
//          navigation/               ← Tabs, Breadcrumb …
//        lib/utils.ts                ← cn() helper (clsx + tailwind-merge)
//
//    client-common/                  ← @mma/client-common — SHARED (web + mobile)
//      src/
//        infrastructure/
//          config.ts                 ← configureApi() — single call at boot
//          api-clients/
//            base-api.client.ts      ← apiRequest<T>() — fetch + Zod parse
//            auth-api.client.ts
//            file-api.client.ts
//          errors/
//            api-error.ts            ← typed ApiError (statusCode, error, message)
//        hooks/
//          use-auth.ts               ← useAuth(), AuthProvider
//          use-file-upload.ts
//          optimistic-mutation.ts
//        lib/
//          query-client.ts           ← shared QueryClient (staleTime, retry)
//          providers.tsx             ← <Providers> wraps QueryClientProvider + AuthProvider
//
//    design-tokens/                  ← @mma/design-tokens — cross-platform tokens
//      src/
//        lib/tokens.ts               ← lightColors, darkColors, spacing, radii …`,

    concepts: [
        'Route groups ( ) organize routes without adding URL segments',
        'Domain components live in apps/ — shared primitives live in packages/',
        'client-common is used by BOTH webapp and mobile (write once)',
        'design-tokens drives Tailwind v4 on web and StyleSheet on mobile',
        'No per-app QueryClient setup — shared via <Providers> from client-common',
        'Auth guard is a hook + useEffect in a layout, not a wrapper component',
    ],

    pitfalls: [
        '<strong>Adding domain components to packages/ui:</strong> UI primitives must be domain-agnostic. A <code>UserBadge</code> belongs in <code>apps/webapp/src/components/users/</code>, not in <code>packages/ui/</code>.',
        '<strong>Duplicating hooks for mobile:</strong> never create a mobile-only API client. Add the method to <code>client-common</code> so both platforms share it.',
        '<strong>Putting global SCSS in apps/:</strong> all styling is Tailwind v4 utilities. If you need a custom token, add it to <code>packages/design-tokens/</code> and regenerate.',
    ],
};
