// Module 03 — Static Site Generation
// Explains output: 'export', why it was chosen, and what it changes about auth + routing.

export default {
    id: '03-static-site-generation',
    level: 2,
    complexityLabel: 'L2 · Deployment',
    domain: 'Infrastructure',
    title: 'Static Site Generation (SSG)',
    introShort: "output: 'export' replaces a running Node.js server with a CDN-delivered static bundle.",
    intro: "The old template required a running Node.js process (or a Lambda/ECS container) to serve each page request. The new template sets output: 'export' in next.config.js, which produces a static HTML + JS bundle under apps/webapp/out/ — deployed to S3 and served via CloudFront. No server, no cold starts, no container costs for the webapp.",

    specTitle: 'Infrastructure · Static Export',
    specBodyHtml: `
    <p><strong>Old template:</strong> no <code>output</code> config → Next.js defaults to server rendering.</p>
    <ul>
      <li>Requires a running Node.js process (ECS Fargate or Lambda container image).</li>
      <li>Server-side redirects: <code>async redirects()</code> in <code>next.config.js</code> handle <code>/</code> → <code>/auth/login</code>.</li>
      <li>Auth middleware runs server-side — can check cookies on the server before rendering.</li>
      <li>Cost: always-on ECS task or Lambda warm-up on every page hit.</li>
    </ul>
    <p><strong>New template:</strong> <code>output: 'export'</code> → fully static bundle.</p>
    <ul>
      <li>Build produces <code>apps/webapp/out/</code> — plain HTML + CSS + JS files.</li>
      <li>Synced to S3 + CloudFront: <code>aws s3 sync out/ s3://bucket</code> then CloudFront invalidation.</li>
      <li>No server-side redirects: <code>async redirects()</code> is incompatible with static export. Auth guard moves to the client (<code>useAuth()</code> + <code>useRouter()</code> in the route group layout).</li>
      <li>Edge middleware (<code>middleware.ts</code>) is also incompatible with static export — not used by default.</li>
      <li>SPA routing: CloudFront returns <code>index.html</code> for all 403/404 responses so the client-side router handles deep links.</li>
      <li>Cost: S3 storage + CloudFront data transfer only — no compute per page request.</li>
    </ul>
    <p><strong>Trade-off:</strong> no server-side rendering means auth protection is UX, not security. The API Gateway + NestJS JWT guards remain the true security boundary for every data request.</p>
  `,

    entityFilename: 'next.config.js',
    entityCode: `// apps/webapp/next.config.js
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — nx-template-v2/apps/web-app/next.config.js
// ─────────────────────────────────────────────────────────────────
// const nextConfig = {
//   nx: { svgr: false },
//   async redirects() {             // ← server-side redirect (SSR only)
//     return [
//       { source: '/', destination: '/auth/login', permanent: true },
//     ];
//   },
//   webpack(config) {
//     config.module.rules.push({ test: /\\.svg$/, use: ['@svgr/webpack'] });
//     return config;
//   },
// };
// → No output setting = server render required (Node.js process per env)

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — old-st-template/apps/webapp/next.config.js
// ─────────────────────────────────────────────────────────────────
const { composePlugins, withNx } = require('@nx/next');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',  // opt-in: ANALYZE=true nx build webapp
});

const nextConfig = {
  nx: {},

  // ✅ Static export — the key addition.
  // Produces apps/webapp/out/ on 'nx build webapp'.
  // Deployed to S3 + served via CloudFront (infra/modules/static-webapp).
  output: 'export',

  transpilePackages: [
    '@old-st/contracts-common',
    '@old-st/contracts-auth',
    // add new @old-st/* packages here when they use TypeScript source
  ],
};

const plugins = [withNx, withBundleAnalyzer];
module.exports = composePlugins(...plugins)(nextConfig);

// ─────────────────────────────────────────────────────────────────
//  What output: 'export' disables  (must NOT use these):
// ─────────────────────────────────────────────────────────────────
//   ✗ next/headers, next/cookies           (server-only APIs)
//   ✗ Route Handlers with POST/PUT/DELETE  (use backend services)
//   ✗ async redirects() / rewrites()       (server config)
//   ✗ middleware.ts (Edge)                 (incompatible with export)
//   ✗ getServerSideProps                   (no server at runtime)
//   ✗ Image Optimization (next/image)      (use unoptimized: true or external CDN)
//
//  What still works:
//   ✅ generateStaticParams / generateMetadata (build-time)
//   ✅ React Server Components (rendered to static HTML at build)
//   ✅ useRouter, useSearchParams (client-side navigation)
//   ✅ React Query (all data fetching is client-side)
//   ✅ All @old-st/ui primitives
//   ✅ Dark mode via next-themes (purely client-side)`,

    concepts: [
        "output: 'export' produces static HTML/JS — no Node.js server at runtime",
        'S3 + CloudFront replaces ECS/Lambda for the webapp — near-zero cost',
        'Auth guard moves to client: useAuth() + useRouter() in layout.tsx',
        'SPA routing: CloudFront serves index.html for all 404/403 responses',
        'API security stays at the backend — client-side guard is UX only',
        'Bundle analyzer: ANALYZE=true pnpm nx run webapp:build',
    ],

    exceptionsFilename: '(protected)/layout.tsx',
    exceptionsCode: `// apps/webapp/src/app/(protected)/layout.tsx
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — ProtectedRoute wrapper component
// ─────────────────────────────────────────────────────────────────
// const ProtectedRoute: React.FC = ({ children }) => {
//   const isAuthenticated = /* read from cookie / context */;
//   if (!isAuthenticated) {
//     return <Navigate to="/auth/login" />;   // or redirect()
//   }
//   return <>{children}</>;
// };
// → Lives in libs/ — shared, but tightly coupled to auth implementation.

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — route group layout with useAuth() hook
// ─────────────────────────────────────────────────────────────────
'use client';

import { useAuth } from '@old-st/client-common';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Client-side guard: redirects to /auth/login if no valid session.
  // This is a UX guard — the real security is the API Gateway JWT authorizer.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;  // avoids flash of protected content

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}`,

    pitfalls: [
        "<strong>Using server APIs in a static export:</strong> importing <code>next/headers</code> or <code>next/cookies</code> inside any component causes a build-time error. All data fetching must be client-side (React Query).",
        '<strong>Relying on the client guard for security:</strong> <code>useAuth()</code> prevents seeing the UI, but JavaScript can be disabled or the HTML can be fetched directly. Every API endpoint must validate the JWT independently.',
        "<strong>Forgetting CloudFront SPA routing:</strong> if CloudFront returns 404 for <code>/users/123</code> instead of serving <code>index.html</code>, the Next.js router never runs. Configure a custom error response: <code>403/404 → /index.html, HTTP 200</code>.",
    ],
};
