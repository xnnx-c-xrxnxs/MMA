// Module 01 — Frontend CLEAN Architecture Overview
// Explains the 5-layer frontend architecture and its dependency rules.

export default {
    id: '01-architecture-overview',
    level: 1,
    complexityLabel: 'L1 · Foundation',
    domain: 'Architecture',
    title: 'Frontend CLEAN Architecture',
    introShort: 'Five layers, each with a single responsibility and a strict dependency rule: no layer may reach more than one level below it.',
    intro: 'The frontend applies the same Clean Architecture discipline as the backend: pages orchestrate, hooks fetch, API clients validate, UI primitives render. Each layer has a single responsibility. The dependency rule is enforced by convention and by the Golden Rules — pages never call fetch, hooks never render markup, API clients never own state.',

    specTitle: 'Architecture · Five Layers',
    specBodyHtml: `
    <p>The frontend stack has <strong>five layers</strong>, each with exactly one job:</p>
    <ul>
      <li><strong>Page</strong> — thin orchestrator. Wires hooks + domain components. Zero markup. Zero fetch calls. Zero <code>useState</code>.</li>
      <li><strong>Domain Component</strong> — renders one slice of domain data using <code>@old-st/ui</code> primitives and React Query hooks.</li>
      <li><strong>React Query Hook</strong> — owns server state (loading, error, data, refetch). Calls one API client method.</li>
      <li><strong>API Client</strong> — typed <code>fetch</code> wrapper. Parses every response with a Zod schema from <code>@old-st/contracts/{domain}</code>.</li>
      <li><strong>UI Primitive</strong> — stateless, domain-agnostic building block. Imports only design tokens and Tailwind classes.</li>
    </ul>
    <p>The <strong>dependency rule</strong>: no layer may reach more than one level below it. A page never imports an API client. A hook never imports a UI primitive. An API client never imports a hook.</p>
    <p>Shared contracts (<code>@old-st/contracts/{domain}</code>) live outside this stack. They are imported at the boundary layers — by API clients (response validation) and by forms (Zod resolver) — and by the NestJS backend (<code>ZodValidationPipe</code>). One schema, two runtimes.</p>
  `,

    entityFilename: 'frontend-architecture.ts',
    entityCode: `// ─────────────────────────────────────────────────────────────────────────
//  Frontend CLEAN Architecture — layer dependency rules
// ─────────────────────────────────────────────────────────────────────────
//
//  apps/webapp/src/app/(protected)/users/page.tsx       ← Page (orchestrator)
//    └─ apps/webapp/src/components/users/users-table.tsx ← Domain Component
//         └─ packages/client-common/src/hooks/use-users.ts ← React Query Hook
//              └─ packages/client-common/src/infrastructure/
//                   api-clients/user-api.client.ts        ← API Client (Zod)
//
//  packages/ui/src/components/                           ← UI Primitives
//    Badge, Button, Card, Table, Input, Select …
//
//  packages/contracts/user/src/schemas.ts                ← Shared Zod types
//    (imported by both the API client AND the NestJS ZodValidationPipe)
//
//  packages/design-tokens/src/lib/tokens.ts              ← Design tokens
//    (CSS custom properties on web; direct imports on mobile)
//
// ─────────────────────────────────────────────────────────────────────────

export type FrontendLayer =
  | 'Page'           // apps/webapp/src/app/
  | 'DomainComponent'// apps/webapp/src/components/{domain}/
  | 'ReactQueryHook' // packages/client-common/src/hooks/
  | 'ApiClient'      // packages/client-common/src/infrastructure/api-clients/
  | 'UiPrimitive';   // packages/ui/src/components/

// ✅ The dependency rule — no layer may import more than one level below it.
export const LAYER_DEPENDENCIES: Record<FrontendLayer, FrontendLayer[]> = {
  Page:            ['DomainComponent'],
  DomainComponent: ['ReactQueryHook', 'UiPrimitive'],
  ReactQueryHook:  ['ApiClient'],
  ApiClient:       [],   // leaf — only imports @old-st/contracts and fetch
  UiPrimitive:     [],   // leaf — only imports design tokens and Tailwind
};

// ── Golden Rules (frontend) ───────────────────────────────────────────────
// Rule 19:  Pages are thin orchestrators — no markup, no fetch, no state.
// Rule 20:  All API calls go through @old-st/client-common hooks.
// Rule 21:  UI primitives come from @old-st/ui — never raw HTML elements.
// Rule 23:  Every API client response is Zod-parsed at the client boundary.
// Rule 23a: All forms use react-hook-form + zodResolver + schema from contracts.
// Rule 23n: Every @old-st/ui primitive ships 4 files: tsx + index.ts + stories + spec.
// Rule 23o: Never use template-literal Tailwind class interpolation (JIT can't emit those classes).`,

    concepts: [
        'Pages are Server Components by default — "use client" only when needed',
        'Hooks own ALL server state — no useEffect + setState for data fetching',
        'API clients parse with Zod at the boundary — type safety at runtime',
        'UI primitives are domain-agnostic — domain knowledge stays in apps/',
        'Contracts are shared between backend NestJS pipe and frontend form resolver',
        'Static export (output: export) — CDN delivery, no Node.js server at runtime',
    ],

    pitfalls: [
        '<strong>Fetching in a page:</strong> calling <code>fetch()</code> or importing API clients directly from a page component breaks layer isolation — use a React Query hook instead.',
        '<strong>Typing API responses manually:</strong> hand-writing <code>type UserResponse = { ... }</code> instead of importing from <code>@old-st/contracts/user</code> causes the types to drift the moment the backend changes.',
        '<strong>Reading <code>process.env</code> in components:</strong> env vars are configured once via <code>configureApi()</code> in <code>layout.tsx</code> — never read them inside a component or hook.',
    ],
};

