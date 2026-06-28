// Module 09 — Component API Patterns, Inline Tailwind, and Tailwind v4 Setup
// Covers: Compound vs Simple component API · inline Tailwind utilities vs SCSS modules
// · Tailwind v4 CSS-first configuration (no tailwind.config.js).

export default {
    id: '09-component-patterns',
    level: 2,
    complexityLabel: 'L2 · Component Design',
    domain: 'UI',
    title: 'Component API Patterns & Tailwind v4',
    introShort: 'Compound components stay as the base primitive; a convenience wrapper handles 80 % of use cases — inline Tailwind replaces SCSS modules.',
    intro: "The old template styled components with SCSS modules alongside scattered Tailwind classes, and used a flat prop-driven component API. The new template uses inline Tailwind v4 utilities exclusively, configured with a CSS-first approach (no tailwind.config.js), and separates component concerns into two tiers: a flexible compound API for the primitive and a thin convenience wrapper for everyday app usage.",

    specTitle: 'Component Design · Three Topics',
    specBodyHtml: `
    <h4 style="margin:0 0 6px;font-size:0.85rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7">1 · Compound vs Simple API</h4>
    <p>The old template used a flat prop-driven API — one component, many props (<code>isOpen</code>, <code>title</code>, <code>showClose</code>, <code>footerActions</code>…). This is fast initially but becomes bloated as requirements grow.</p>
    <p>The new template follows the <strong>compound component pattern</strong> from shadcn/Radix as the <em>base primitive</em>, then adds a thin <strong>convenience wrapper</strong> for common app usage:</p>
    <ul>
      <li><strong>Base primitive</strong> — <code>Modal, ModalTrigger, ModalContent, ModalHeader, ModalBody, ModalFooter</code> (full composability, zero layout constraints).</li>
      <li><strong>Convenience wrapper</strong> — <code>AppModal</code> accepts <code>isOpen</code>, <code>title</code>, <code>onClose</code>, <code>children</code> and optional <code>actions</code>. Used in 80 % of app screens.</li>
      <li>Feature pages use <code>AppModal</code>; unusual dialogs (multi-step, custom footer) drop down to the compound primitive.</li>
    </ul>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0 14px">
      <div>
        <p style="margin:0 0 6px;font-size:0.78rem;text-transform:uppercase;letter-spacing:.05em;opacity:.6">✅ Simple / prop-driven — pros</p>
        <ul style="margin:0;padding-left:1.2em;font-size:0.82rem">
          <li>Minimal boilerplate — one import, one JSX element</li>
          <li>Easy to discover — all options visible in TypeScript autocomplete</li>
          <li>Fast for beginners — no knowledge of sub-components needed</li>
          <li>Controlled state (<code>isOpen</code>) works well out of the box</li>
        </ul>
      </div>
      <div>
        <p style="margin:0 0 6px;font-size:0.78rem;text-transform:uppercase;letter-spacing:.05em;opacity:.6">❌ Simple / prop-driven — cons</p>
        <ul style="margin:0;padding-left:1.2em;font-size:0.82rem">
          <li>Props accumulate — every new layout requirement adds a boolean (<code>hideHeader</code>, <code>showDivider</code>…)</li>
          <li>Conditional rendering logic leaks into the component internals</li>
          <li>Impossible to reorder or rearrange sections without new props</li>
          <li>Testing grows harder as prop combinations multiply</li>
        </ul>
      </div>
      <div>
        <p style="margin:0 0 6px;font-size:0.78rem;text-transform:uppercase;letter-spacing:.05em;opacity:.6">✅ Compound + wrapper — pros</p>
        <ul style="margin:0;padding-left:1.2em;font-size:0.82rem">
          <li>Zero prop explosion — new layouts compose sub-components, never add props</li>
          <li>Each sub-component is independently testable and styleable</li>
          <li>Wrapper (<code>AppModal</code>) keeps everyday usage just as simple as the prop-driven pattern</li>
          <li>Accessible by default — Radix manages focus trap, ARIA roles, keyboard nav</li>
          <li>Inversion of control — caller owns the layout, not the component</li>
        </ul>
      </div>
      <div>
        <p style="margin:0 0 6px;font-size:0.78rem;text-transform:uppercase;letter-spacing:.05em;opacity:.6">❌ Compound + wrapper — cons</p>
        <ul style="margin:0;padding-left:1.2em;font-size:0.82rem">
          <li>More files — primitive + wrapper + types instead of one component</li>
          <li>Higher learning curve — caller must understand the sub-component tree</li>
          <li>Context coupling — sub-components only work inside their parent root (<code>&lt;Modal&gt;</code>)</li>
          <li>Over-engineering risk for truly simple, never-changing UI elements</li>
        </ul>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-top:4px">
      <thead><tr style="background:rgba(255,255,255,.06)">
        <th style="padding:6px 8px;text-align:left">Dimension</th>
        <th style="padding:6px 8px;text-align:left">Simple / prop-driven (old)</th>
        <th style="padding:6px 8px;text-align:left">Compound + wrapper (new)</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:5px 8px">Boilerplate per usage</td><td style="padding:5px 8px">Low (1 component)</td><td style="padding:5px 8px">Low via wrapper; full control via primitive</td></tr>
        <tr><td style="padding:5px 8px">Custom header / footer</td><td style="padding:5px 8px">Extra props, ad-hoc booleans</td><td style="padding:5px 8px">Drop to compound — no prop explosion</td></tr>
        <tr><td style="padding:5px 8px">Multi-step content</td><td style="padding:5px 8px">Awkward</td><td style="padding:5px 8px">Natural — compose ModalBody children freely</td></tr>
        <tr><td style="padding:5px 8px">Controlled open state (URL, wizard)</td><td style="padding:5px 8px">Good — <code>isOpen</code> prop works well</td><td style="padding:5px 8px">Good — wrapper exposes <code>isOpen</code> + <code>onClose</code></td></tr>
        <tr><td style="padding:5px 8px">API bloat over time</td><td style="padding:5px 8px">High — props accumulate</td><td style="padding:5px 8px">Low — new layouts use compound, not new props</td></tr>
        <tr><td style="padding:5px 8px">Accessibility</td><td style="padding:5px 8px">Manual — must add ARIA attrs by hand</td><td style="padding:5px 8px">Built-in — Radix handles focus trap + ARIA roles</td></tr>
        <tr><td style="padding:5px 8px">When to use</td><td style="padding:5px 8px">Simple, stable UI that never needs layout variation</td><td style="padding:5px 8px">Any UI that designers will iterate on over time</td></tr>
      </tbody>
    </table>

    <h4 style="margin:16px 0 6px;font-size:0.85rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7">2 · Inline Tailwind vs SCSS Modules</h4>
    <p>The old template co-located a <code>.module.scss</code> for every component, then also added Tailwind utility classes into the SCSS (<code>@apply</code>) — two systems at once, neither owning the truth.</p>
    <p><strong>Why inline Tailwind wins:</strong></p>
    <ul>
      <li><strong>Single source of truth</strong> — style is on the element, not in a separate file you have to open.</li>
      <li><strong>No context-switch</strong> — designer, reviewer, and AI all see the styling without leaving the component.</li>
      <li><strong>No dead CSS</strong> — deleting a component deletes its styles; SCSS files linger.</li>
      <li><strong>Tokens enforced</strong> — Tailwind utility classes map to the design-token layer automatically; ad-hoc colour values are impossible without <code>[]</code> escape hatch, which is immediately visible in review.</li>
      <li><strong>Dark mode in one place</strong> — <code>dark:bg-card</code> sits next to <code>bg-card</code> on the element; no <code>.dark</code> block in a remote SCSS file.</li>
      <li><strong>Build output</strong> — Tailwind v4's JIT emits only the classes present in source; <code>@apply</code> in SCSS bypassed the scanner, causing larger CSS output.</li>
    </ul>

    <h4 style="margin:16px 0 6px;font-size:0.85rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7">3 · Tailwind v4 Setup — CSS-First (No tailwind.config.js)</h4>
    <p>Tailwind v4 replaces the JS config file with a <strong>CSS-first</strong> approach. All tokens, source paths, and plugin config live in <code>globals.css</code>.</p>
    <ul>
      <li><strong>Old:</strong> <code>tailwind.config.js</code> with <code>content: [...]</code>, <code>theme.extend</code> and <code>plugins</code>.</li>
      <li><strong>New:</strong> <code>@import "tailwindcss"</code> at the top of <code>globals.css</code>; tokens in <code>@theme { --color-primary: ... }</code>; dark overrides in <code>.dark { --color-primary: ... }</code>; source paths via <code>@source "../../packages/ui/src"</code>.</li>
    </ul>
    <p>Result: one file owns all styling configuration — easier to audit, diff, and share with designers.</p>
  `,

    entityFilename: 'modal.tsx',
    entityCode: `// packages/ui/src/components/overlay/modal/modal.tsx
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — flat prop API (libs/frontend/components-web)
// ─────────────────────────────────────────────────────────────────
// // ❌ One component, every layout concern crammed into props.
// // Growing requirements → prop explosion.
//
// interface ModalProps {
//   isOpen: boolean;
//   title: string;
//   onClose: () => void;
//   children: ReactNode;
//   showClose?: boolean;         // added later
//   footerActions?: ReactNode;   // added later
//   hideHeader?: boolean;        // added later — now it's getting ugly
//   width?: 'sm' | 'md' | 'lg'; // added later
// }
// import styles from './modal.module.scss'; // separate file required

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — compound primitive + convenience wrapper
// ─────────────────────────────────────────────────────────────────
'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

// ── 1. Compound primitives (full flexibility) ──────────────────────
const Modal        = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalPortal  = DialogPrimitive.Portal;
const ModalClose   = DialogPrimitive.Close;

function ModalOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out',
        className,
      )}
      {...props}
    />
  );
}

function ModalContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
          'bg-background rounded-lg border shadow-lg p-6',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          className,
        )}
        {...props}
      >
        {children}
        <ModalClose className="absolute right-4 top-4 opacity-70 hover:opacity-100 transition-opacity">
          <X className="h-4 w-4" />
        </ModalClose>
      </DialogPrimitive.Content>
    </ModalPortal>
  );
}

function ModalHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 mb-4', className)} {...props} />;
}
function ModalTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />;
}
function ModalBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-2 mt-6', className)} {...props} />;
}

export { Modal, ModalTrigger, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter };

// ── 2. Convenience wrapper for 80 % of app screens ────────────────
// Use this in feature pages — drop to the compound API only for custom layouts.
interface AppModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;   // optional footer row
}

export function AppModal({ isOpen, title, onClose, children, actions }: AppModalProps) {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent>
        <ModalHeader><ModalTitle>{title}</ModalTitle></ModalHeader>
        <ModalBody>{children}</ModalBody>
        {actions && <ModalFooter>{actions}</ModalFooter>}
      </ModalContent>
    </Modal>
  );
}`,

    concepts: [
        'Compound primitives expose every seam — no layout assumption is baked in',
        'Convenience wrappers (AppModal) cover the 80 % case with minimal props',
        'Inline Tailwind keeps style co-located — no context-switch to a .scss file',
        'Tailwind v4 is CSS-first: @theme, @source, .dark overrides all in globals.css',
        'No tailwind.config.js in Tailwind v4 — the config file is gone entirely',
        'cva() + cn() handle variants and class merging without any SCSS',
    ],

    exceptionsFilename: 'globals.css (Tailwind v4 vs v3)',
    exceptionsCode: `/* ─────────────────────────────────────────────────────────────────
   OLD TEMPLATE — Tailwind v3 with tailwind.config.js
   ─────────────────────────────────────────────────────────────────

   // tailwind.config.js (old)
   module.exports = {
     content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
     darkMode: 'class',
     theme: {
       extend: {
         colors: {
           primary: '#4f46e5',
           background: '#ffffff',
         },
       },
     },
     plugins: [require('daisyui'), require('@tailwindcss/typography')],
   };

   // globals.scss (old) — mixed SCSS + @apply
   .modal-overlay {
     @apply fixed inset-0 bg-black/80;  // Tailwind inside SCSS — two systems
     z-index: 50;
   }
   .modal-content {
     background-color: $bg-color;       // SCSS variable — not a design token
     @apply rounded-lg p-6;
   }

   Problems:
   - Two config surfaces (tailwind.config.js + scss vars) drift over time.
   - @apply inside SCSS bypasses the JIT scanner → larger CSS output.
   - Dark mode requires a separate .dark { } block in the SCSS file,
     far removed from the light-mode class.
*/

/* ─────────────────────────────────────────────────────────────────
   NEW TEMPLATE — Tailwind v4 CSS-first (no tailwind.config.js)
   ─────────────────────────────────────────────────────────────────ﾠ*/

/* 1. Import Tailwind v4 engine — replaces the JS config entry point. */
@import "tailwindcss";

/* 2. Tell the JIT scanner where to find class names in workspace packages. */
@source "../../packages/ui/src";
@source "../../packages/mobile-ui/src";

/* 3. Define design tokens as CSS custom properties inside @theme.
      Tailwind v4 auto-generates utilities (bg-primary, text-foreground, etc.)
      from every --color-* variable declared here.               */
@theme {
  --color-background:        hsl(0 0% 100%);
  --color-foreground:        hsl(222.2 84% 4.9%);
  --color-primary:           hsl(221.2 83.2% 53.3%);
  --color-primary-foreground:hsl(210 40% 98%);
  --color-card:              hsl(0 0% 100%);
  --color-muted:             hsl(210 40% 96.1%);
  --color-muted-foreground:  hsl(215.4 16.3% 46.9%);
  --color-border:            hsl(214.3 31.8% 91.4%);
  --radius-lg: 0.5rem;
  --radius-md: calc(var(--radius-lg) - 2px);
}

/* 4. Dark mode — override only the tokens that change.
      No separate SCSS file, no .module.scss, no @apply.          */
.dark {
  --color-background:        hsl(222.2 84% 4.9%);
  --color-foreground:        hsl(210 40% 98%);
  --color-primary:           hsl(217.2 91.2% 59.8%);
  --color-card:              hsl(222.2 84% 4.9%);
  --color-muted:             hsl(217.2 32.6% 17.5%);
  --color-muted-foreground:  hsl(215 20.2% 65.1%);
  --color-border:            hsl(217.2 32.6% 17.5%);
}

/* ✅ Result: one file — all token definitions, dark overrides,
   source paths, and plugin config. No tailwind.config.js exists.
   Components use inline utilities only:

   <div className="bg-background text-foreground rounded-lg p-6 dark:bg-card">

   Style is on the element. No .scss file. No @apply. No drift.   */`,

    pitfalls: [
        "<strong>Don't flatten the compound API by adding props to AppModal:</strong> when a new layout requirement appears, drop to the compound primitive. Never add <code>hideHeader</code>, <code>showDivider</code> or similar booleans to the convenience wrapper — that defeats its purpose.",
        "<strong>No <code>@apply</code> in Tailwind v4:</strong> <code>@apply</code> inside CSS files bypasses the JIT class scanner and produces larger output. Write utilities inline on the element or use <code>cva()</code> for variant groups.",
        "<strong>Don't create a <code>tailwind.config.js</code> in a v4 project:</strong> it will silently conflict. All configuration belongs in the CSS file via <code>@theme</code>, <code>@source</code>, and <code>@plugin</code>.",
        "<strong>Template-literal class interpolation still fails in v4:</strong> <code>className={`bg-${color}`}</code> is not statically scannable. Use a <code>cva()</code> variant map — see Module 05.",
    ],
};
