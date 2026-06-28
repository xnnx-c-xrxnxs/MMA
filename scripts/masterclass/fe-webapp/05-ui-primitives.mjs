// Module 05 — UI Primitives (@old-st/ui)
// Compares the old SCSS component library with shadcn-style primitives + Tailwind v4 + cva().

export default {
    id: '05-ui-primitives',
    level: 2,
    complexityLabel: 'L2 · Design System',
    domain: 'UI',
    title: 'UI Primitives — @old-st/ui',
    introShort: 'shadcn-style primitives + cva() variants replace a global SCSS component library.',
    intro: "The old template maintained a components-web library of SCSS-styled React components with no variant system. The new template uses @old-st/ui — shadcn-style primitives built on Radix UI, styled with Tailwind v4 utilities and class-variance-authority (cva()) for type-safe variants. Every primitive has a story (Storybook 8) and a co-located test.",

    specTitle: 'UI · Primitive Rules',
    specBodyHtml: `
    <p><strong>Old template (components-web):</strong></p>
    <ul>
      <li>Components in <code>libs/frontend/components-web/src/</code> styled with <code>.scss</code> files.</li>
      <li>No variant system — conditional classes added ad-hoc with ternaries.</li>
      <li>No Storybook; no co-located tests.</li>
      <li>Duplicated between web and mobile — mobile had separate SCSS.</li>
    </ul>
    <p><strong>New template (@old-st/ui):</strong></p>
    <ul>
      <li>Every primitive is a <strong>shadcn-style</strong> component: Radix UI headless + Tailwind utilities.</li>
      <li>Variants declared with <strong><code>cva()</code></strong> (class-variance-authority) — fully type-safe.</li>
      <li>Design tokens from <code>@old-st/design-tokens</code> feed CSS custom properties — no hardcoded colours.</li>
      <li>Each primitive ships: <code>{name}.tsx</code> + <code>index.ts</code> + <code>{name}.stories.tsx</code> + <code>{name}.spec.tsx</code>.</li>
      <li>No SCSS anywhere in <code>packages/ui/</code> — Tailwind v4 utilities only.</li>
      <li>Dark mode via CSS variable overrides in <code>globals.css</code> under <code>.dark</code>.</li>
    </ul>
    <p><strong>Rule 23n:</strong> every primitive ships four files; rule 23o: never use template-literal Tailwind class interpolation.</p>
  `,

    entityFilename: 'badge.tsx',
    entityCode: `// packages/ui/src/components/data-display/badge/badge.tsx
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — libs/frontend/components-web/src/data-display/
// ─────────────────────────────────────────────────────────────────
// // badge.tsx (old)
// import styles from './badge.module.scss';
// interface BadgeProps { children: React.ReactNode; variant?: string; }
// export const Badge = ({ children, variant = 'default' }: BadgeProps) => (
//   <span className={\`\${styles.badge} \${styles[variant] ?? ''}\`}>
//     {children}
//   </span>
// );
// Problems: string variant with no type safety; SCSS drift; no dark mode tokens.

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — packages/ui/src/components/data-display/badge/badge.tsx
// ─────────────────────────────────────────────────────────────────
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

// cva() declares all valid variant combinations at compile time.
// TypeScript will reject <Badge variant="invented" /> at the call site.
const badgeVariants = cva(
  // Base classes applied to every badge (Tailwind v4 utilities)
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-primary text-primary-foreground',
        secondary:   'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline:     'text-foreground',
        success:     'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        warning:     'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
        info:        'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

// VariantProps<typeof badgeVariants> gives TypeScript the full union type.
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

// React 19: ref is a plain prop — no forwardRef wrapper needed.
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };`,

    concepts: [
        'cva() enforces variant types — no runtime string mistakes',
        'cn() merges Tailwind classes without duplication (clsx + tailwind-merge)',
        'Design tokens feed CSS custom properties — dark mode is automatic',
        'Radix UI handles accessibility (keyboard, focus, ARIA) for interactive primitives',
        'No SCSS — Tailwind v4 utilities only (scanned statically by JIT)',
        'Four-file rule: tsx + index.ts + stories.tsx + spec.tsx per primitive',
    ],

    exceptionsFilename: 'status-variants.ts',
    exceptionsCode: `// apps/webapp/src/lib/status-variants.ts
//
// Maps domain entity status constants → badge variant strings.
// This file belongs in apps/webapp (domain knowledge), NOT in packages/ui (primitives).
//
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — ad-hoc inline ternaries in components
// ─────────────────────────────────────────────────────────────────
// // Inside a component (old):
// const color = status === 'ACTIVE' ? 'green' : status === 'PENDING' ? 'yellow' : 'red';
// // ↑ string literals, no type safety, duplicated across every component.

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — centralised map using domain enum constants
// ─────────────────────────────────────────────────────────────────
import type { BadgeProps } from '@old-st/ui';
import { UserStatusEnum } from '@old-st/contracts/user';
import { OrderStatusEnum } from '@old-st/contracts/order';
import { ProductStatusEnum } from '@old-st/contracts/product';

// ✅ Keys are enum values — TypeScript prevents stale string literals.
export const USER_STATUS_VARIANTS: Record<string, BadgeProps['variant']> = {
  [UserStatusEnum.ACTIVE]:   'success',
  [UserStatusEnum.PENDING]:  'warning',
  [UserStatusEnum.INACTIVE]: 'secondary',
  [UserStatusEnum.DELETED]:  'destructive',
};

export const ORDER_STATUS_VARIANTS: Record<string, BadgeProps['variant']> = {
  [OrderStatusEnum.DRAFT]:     'secondary',
  [OrderStatusEnum.PENDING]:   'warning',
  [OrderStatusEnum.PROCESSING]:'info',
  [OrderStatusEnum.COMPLETED]: 'success',
  [OrderStatusEnum.CANCELLED]: 'destructive',
};

export const PRODUCT_STATUS_VARIANTS: Record<string, BadgeProps['variant']> = {
  [ProductStatusEnum.ACTIVE]:       'success',
  [ProductStatusEnum.DISCONTINUED]: 'destructive',
};

// Usage in a domain component:
// <Badge variant={USER_STATUS_VARIANTS[user.userStatus] ?? 'default'}>
//   {user.userStatus}
// </Badge>`,

    pitfalls: [
        "<strong>Template-literal Tailwind classes:</strong> <code>className={`bg-${'brand'}-500`}</code> produces <em>no styles</em> — Tailwind v4's JIT scanner never sees this string. Use a <code>cva()</code> variant map or <code>style={{ backgroundColor: token }}</code> for dynamic values.",
        '<strong>Adding domain knowledge to @old-st/ui:</strong> a <code>UserStatusBadge</code> that knows about <code>UserStatusEnum</code> belongs in <code>apps/webapp/src/components/users/</code>. The primitives package must stay domain-agnostic.',
        "<strong>Skipping co-located tests:</strong> the 70% coverage threshold on <code>packages/ui</code> is enforced by CI. Every new primitive needs a <code>.spec.tsx</code> testing at minimum the default render and each variant.",
    ],
};
