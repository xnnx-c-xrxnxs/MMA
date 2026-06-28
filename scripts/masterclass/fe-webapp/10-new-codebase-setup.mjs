// Module 10 — New Codebase Setup: Design Tokens · Icons · Figma Components
// Covers: step-by-step process for bootstrapping a fresh webapp with a design system
// Steps: 1) import design tokens  2) convert SVG → typed icon components  3) wire Figma components

export default {
    id: '10-new-codebase-setup',
    level: 2,
    complexityLabel: 'L2 · Design System Bootstrap',
    domain: 'Setup',
    title: 'New Codebase Setup: Tokens → Icons → Figma',
    introShort: 'Bootstrap a production design system in three ordered steps — tokens first, icons second, Figma components last. Each step builds on the previous.',
    intro: "Starting a new webapp without a plan produces scattered hex values, duplicated SVGs, and Figma components that drift from code. The correct order is: (1) wire the design token pipeline so every colour and spacing value has a named utility, (2) convert all SVG assets into typed React components so icons are statically typed and tree-shaken, (3) implement Figma components top-down — primitives before pages — mapping every visual decision to the tokens already in place.",

    specTitle: 'Step-by-Step Bootstrap Checklist',
    specBodyHtml: `
    <!-- ── Prompt Cheatsheet ─────────────────────────────────────── -->
    <div style="background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.22);border-radius:10px;padding:16px 20px;margin-bottom:22px">
      <p style="margin:0 0 12px;font-size:0.78rem;text-transform:uppercase;letter-spacing:.07em;font-weight:700;opacity:.65">Claude Code Commands — Run in Order</p>
      <div style="display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px 16px;font-size:0.88rem">

        <!-- Step 1 -->
        <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(99,102,241,.18);font-weight:700;font-size:.75rem;flex-shrink:0">1</span>
        <div>
          <strong>Import Design Tokens</strong>
          <p style="margin:2px 0 0;font-size:0.8rem;opacity:.7">Export Figma variables → <code>tokens.ts</code> → generate <code>tokens.css</code> → wire <code>globals.css</code></p>
        </div>
        <code style="white-space:nowrap;background:rgba(99,102,241,.12);padding:3px 8px;border-radius:5px;font-size:.8rem">/figma-import-tokens</code>

        <!-- divider -->
        <div style="grid-column:1/-1;border-top:1px solid rgba(99,102,241,.12);margin:2px 0"></div>

        <!-- Step 2 -->
        <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(99,102,241,.18);font-weight:700;font-size:.75rem;flex-shrink:0">2</span>
        <div>
          <strong>Convert SVG → Typed Icon Components</strong>
          <p style="margin:2px 0 0;font-size:0.8rem;opacity:.7">Run SVGR · define <code>IIcon</code> interface · barrel-export from <code>@old-st/ui</code></p>
        </div>
        <code style="white-space:nowrap;background:rgba(99,102,241,.12);padding:3px 8px;border-radius:5px;font-size:.8rem">/svg-to-icons</code>

        <!-- divider -->
        <div style="grid-column:1/-1;border-top:1px solid rgba(99,102,241,.12);margin:2px 0"></div>

        <!-- Step 3 -->
        <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(99,102,241,.18);font-weight:700;font-size:.75rem;flex-shrink:0">3</span>
        <div>
          <strong>Implement Figma Components</strong>
          <p style="margin:2px 0 0;font-size:0.8rem;opacity:.7">Classify primitives vs pages → implement tokens-first → wire <code>IIcon</code> slots → port screens</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          <code style="white-space:nowrap;background:rgba(99,102,241,.12);padding:3px 8px;border-radius:5px;font-size:.8rem">/figma-component</code>
          <span style="font-size:0.72rem;opacity:.55;text-align:right">with Figma URL</span>
          <code style="white-space:nowrap;background:rgba(16,185,129,.12);padding:3px 8px;border-radius:5px;font-size:.8rem">/new-ui-primitive</code>
          <span style="font-size:0.72rem;opacity:.55;text-align:right">without Figma URL</span>
        </div>
      </div>
    </div>
    <!-- ── / Prompt Cheatsheet ────────────────────────────────────── -->

    <h4 style="margin:0 0 6px;font-size:0.85rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7">Step 1 · Import Design Tokens</h4>
    <p>Tokens are the contract between the designer and the codebase. They must be set up <em>before</em> any component is written — otherwise the first component hard-codes a hex value that you will chase forever.</p>
    <ol>
      <li><strong>Export tokens from Figma</strong> — use the Figma Tokens / Variables plugin to export a JSON of all colour, spacing, radius, and typography values. Save as <code>packages/design-tokens/src/lib/tokens.ts</code>.</li>
      <li><strong>Define <code>lightColors</code> and <code>darkColors</code></strong> — two typed maps (see code panel). Mobile imports them directly; web consumes them via CSS variables.</li>
      <li><strong>Generate <code>tokens.css</code></strong> — run <code>pnpm tokens:gen</code>. This script writes <code>:root { --color-primary: ... }</code> and <code>.dark { --color-primary: ... }</code> blocks from the TypeScript maps.</li>
      <li><strong>Import in <code>globals.css</code></strong> — add <code>@import "@old-st/design-tokens/tokens.css"</code> above the <code>@theme {}</code> block. Tailwind v4 reads the CSS variables and exposes them as utilities (<code>bg-primary</code>, <code>text-foreground</code>, etc.).</li>
      <li><strong>Verify</strong> — open any page; all <code>bg-*</code> and <code>text-*</code> utilities resolve without warnings. Toggle dark mode — colours swap without any JavaScript.</li>
    </ol>
    <p style="margin-top:8px"><strong>Rule:</strong> no raw hex or <code>rgb()</code> values anywhere in component files. If a colour is not in the token map, add it to the token map first — then use the utility class.</p>

    <h4 style="margin:16px 0 6px;font-size:0.85rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7">Step 2 · Convert SVG to Typed Icon Components</h4>
    <p>Raw SVG files scattered in <code>public/</code> or inlined in components are not tree-shaken, not typed, and cannot be themed. Convert them once into typed React components before any component imports an icon.</p>
    <ol>
      <li><strong>Export SVGs from Figma</strong> — select all icons on the icon frame, export at 1× as SVG (no effects, no extra wrappers). Name files in <code>kebab-case</code>: <code>arrow-right.svg</code>, <code>check-circle.svg</code>.</li>
      <li><strong>Run SVGR</strong> — <code>pnpm svgr --icon --typescript --out-dir packages/ui/src/components/icons/generated src/assets/icons/</code>. Each SVG becomes a <code>ArrowRightIcon.tsx</code> exporting a standard React component that accepts <code>className</code> and <code>size</code>.</li>
      <li><strong>Define the <code>IIcon</code> interface</strong> — a shared prop contract for all icon components (see code panel). This makes every icon interchangeable — a component that accepts <code>icon: IIcon</code> works with any icon from the set.</li>
      <li><strong>Barrel-export from <code>packages/ui/src/components/icons/index.ts</code></strong> — one export per icon so consumers import precisely what they use: <code>import { ArrowRightIcon } from '@old-st/ui'</code>.</li>
      <li><strong>Theme icons with <code>currentColor</code></strong> — SVGR replaces hard-coded fills with <code>fill="currentColor"</code> automatically. Set colour via <code>className="text-primary"</code> on the icon element — it inherits from the parent.</li>
    </ol>
    <p style="margin-top:8px"><strong>Rule:</strong> never copy SVG markup into a component. Never use <code>&lt;img src="icon.svg"&gt;</code> for UI icons — images are not themeable and not accessible without extra aria attributes.</p>

    <h4 style="margin:16px 0 6px;font-size:0.85rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7">Step 3 · Implement Figma Components</h4>
    <p>With tokens and icons in place, every Figma component can be faithfully implemented. Work primitives-first: shared building blocks before domain-specific pages.</p>
    <ol>
      <li><strong>Classify components</strong> — open the Figma file, identify which frames are <em>primitives</em> (Button, Badge, Card, Input, Select, Modal…) and which are <em>page sections</em> (UserTable, CreateOrderForm…). Primitives go in <code>packages/ui/</code>; page sections go in <code>apps/webapp/src/components/{domain}/</code>.</li>
      <li><strong>Run <code>/figma-component</code> workflow for each primitive</strong> — paste the Figma URL → Claude Code fetches <code>get_design_context</code>, maps visual properties to token utilities, and scaffolds the component file with <code>cva()</code> variants, a Storybook story, and a Jest spec.</li>
      <li><strong>Map tokens explicitly</strong> — for each fill, stroke, and spacing value the design context returns, confirm it matches a token in <code>tokens.ts</code>. If it does not match, add the token first (Step 1), then use the utility class. Never accept a raw hex value in generated code.</li>
      <li><strong>Wire the <code>IIcon</code> interface where icons appear</strong> — if a Figma component shows an icon slot, type it as <code>icon?: IIcon</code> and render <code>{icon &amp;&amp; &lt;icon className="..." /&gt;}</code>. This keeps the component decoupled from any specific icon.</li>
      <li><strong>Run <code>/figma-page</code> workflow for each screen</strong> — after all required primitives exist, port each Figma screen to a Next.js page. The workflow decomposes the screen into sections and maps each section to existing primitives. It will flag any missing primitive and recurse into <code>/figma-component</code> before continuing.</li>
      <li><strong>Verify tokens round-trip</strong> — inspect the rendered page in the browser and compare against the Figma design. Open the design-preview route (<code>/design-preview</code>) to confirm all token values match the Figma variables export.</li>
    </ol>
    <p style="margin-top:8px"><strong>Why this order?</strong> Tokens first means every component created in Steps 2–3 automatically inherits dark mode and theming. Icons second means the Figma component workflow in Step 3 can reference a typed <code>IIcon</code> slot instead of inlining SVG. Primitives before pages means there is never a moment when a page component depends on a primitive that does not yet exist.</p>
  `,

    entityFilename: 'tokens.ts + globals.css',
    entityCode: `// packages/design-tokens/src/lib/tokens.ts
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — colours hard-coded in SCSS variables + component files
// ─────────────────────────────────────────────────────────────────
// // ❌ No shared token source — values scattered across files.
// // Each SCSS file defines its own variables:
//
// // _variables.scss
// $color-primary: #4f46e5;
// $color-bg:      #ffffff;
// $color-text:    #111827;
//
// // button.module.scss
// .btn-primary { background-color: #4f46e5; } // duplicated raw hex
//
// // card.module.scss
// .card { background: #ffffff; border: 1px solid #e5e7eb; } // duplicated
//
// Problems:
// - Dark mode requires a parallel set of variables with .dark prefix
// - Mobile cannot consume SCSS variables
// - Changing a colour requires grep across all files
// - Figma tokens and code drift within weeks

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — single token source, consumed by web + mobile
// ─────────────────────────────────────────────────────────────────

// 1. Token source of truth (TypeScript — mobile imports this directly)
export const lightColors = {
  background:           'hsl(0 0% 100%)',
  foreground:           'hsl(222.2 84% 4.9%)',
  primary:              'hsl(221.2 83.2% 53.3%)',
  'primary-foreground': 'hsl(210 40% 98%)',
  card:                 'hsl(0 0% 100%)',
  'card-foreground':    'hsl(222.2 84% 4.9%)',
  muted:                'hsl(210 40% 96.1%)',
  'muted-foreground':   'hsl(215.4 16.3% 46.9%)',
  border:               'hsl(214.3 31.8% 91.4%)',
  destructive:          'hsl(0 84.2% 60.2%)',
  success:              'hsl(142.1 76.2% 36.3%)',
  warning:              'hsl(37.7 92.1% 50.2%)',
} as const;

export const darkColors = {
  background:           'hsl(222.2 84% 4.9%)',
  foreground:           'hsl(210 40% 98%)',
  primary:              'hsl(217.2 91.2% 59.8%)',
  'primary-foreground': 'hsl(222.2 47.4% 11.2%)',
  card:                 'hsl(222.2 84% 4.9%)',
  'card-foreground':    'hsl(210 40% 98%)',
  muted:                'hsl(217.2 32.6% 17.5%)',
  'muted-foreground':   'hsl(215 20.2% 65.1%)',
  border:               'hsl(217.2 32.6% 17.5%)',
  destructive:          'hsl(0 62.8% 30.6%)',
  success:              'hsl(142.1 70.6% 45.3%)',
  warning:              'hsl(37.7 92.1% 60.2%)',
} as const;

export type ColorToken = keyof typeof lightColors;

// ── 2. Token generation script (scripts/generate-tokens.ts) ──────
// Reads lightColors + darkColors and writes tokens.css:
//
// :root {
//   --color-background: hsl(0 0% 100%);
//   --color-primary:    hsl(221.2 83.2% 53.3%);
//   ...
// }
// .dark {
//   --color-background: hsl(222.2 84% 4.9%);
//   ...
// }
//
// Run: pnpm tokens:gen

// ── 3. apps/webapp/src/app/globals.css ───────────────────────────
//
// @import "@old-st/design-tokens/tokens.css";  // ← generated CSS vars
// @import "tailwindcss";
//
// @theme {
//   // Tailwind v4 reads --color-* vars and creates bg-*, text-* utilities
//   --color-background: var(--color-background);
//   --color-foreground: var(--color-foreground);
//   --color-primary:    var(--color-primary);
//   ...
// }
//
// ✅ Result: <div className="bg-primary text-primary-foreground">
//    changes colour in dark mode automatically — zero JS required.`,

    concepts: [
        'Tokens first — every component written after Step 1 inherits dark mode for free',
        'lightColors + darkColors in TypeScript: mobile imports directly, web converts to CSS vars',
        'pnpm tokens:gen generates tokens.css from the TypeScript map — one command keeps them in sync',
        'Tailwind v4 @theme reads CSS custom properties and generates utilities automatically',
        'SVGR converts SVGs to React components with fill="currentColor" — coloured via className',
        'IIcon interface makes every icon interchangeable — components stay decoupled from specific icons',
        '/figma-component workflow: get_design_context → map to tokens → cva() variants → story + spec',
        '/figma-page workflow: decompose screen into sections → map to existing primitives → recurse if missing',
        'Primitives before pages: a page can never depend on a primitive that does not yet exist',
    ],

    exceptionsFilename: 'icon.tsx (SVG → typed React component)',
    exceptionsCode: `// packages/ui/src/components/icons/
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — raw SVG markup inlined in components
// ─────────────────────────────────────────────────────────────────
// // ❌ SVG copied from Figma directly into the component file.
// // No typing, no theming, no tree-shaking.
//
// function UserCard({ user }) {
//   return (
//     <div>
//       {/* Raw SVG pasted inline — not themed, not typed */}
//       <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//         <path d="M8 0a4 4 0 1 1 0 8A4 4 0 0 1 8 0Z" fill="#6b7280"/>
//         <path d="M0 14s1-4 8-4 8 4 8 4" stroke="#6b7280"/>
//       </svg>
//       {user.name}
//     </div>
//   );
// }
//
// Problems:
// - fill="#6b7280" is hard-coded — dark mode breaks
// - No IDE autocomplete for icon names
// - Changing one icon means grepping every file it was pasted into
// - Bundle includes every SVG ever pasted, even unused ones

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — IIcon interface + SVGR-generated components
// ─────────────────────────────────────────────────────────────────

// 1. Shared icon interface (packages/ui/src/components/icons/icon.types.ts)
export interface IIcon {
  (props: React.SVGProps<SVGSVGElement> & { size?: number }): React.ReactElement;
}

// 2. SVGR-generated component (auto-created — do not hand-write)
//    pnpm svgr --icon --typescript --out-dir packages/ui/src/components/icons/generated \\
//              src/assets/icons/
//
// packages/ui/src/components/icons/generated/UserIcon.tsx
import type { IIcon } from '../icon.types';

export const UserIcon: IIcon = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"   // ← SVGR replaces hard-coded fills
    aria-hidden="true"
    {...props}
  >
    <path d="M8 0a4 4 0 1 1 0 8A4 4 0 0 1 8 0Z" />
    <path d="M0 14s1-4 8-4 8 4 8 4" fill="none" stroke="currentColor" />
  </svg>
);

// 3. Barrel export (packages/ui/src/components/icons/index.ts)
export { UserIcon }    from './generated/UserIcon';
export { ArrowRightIcon } from './generated/ArrowRightIcon';
export { CheckCircleIcon } from './generated/CheckCircleIcon';
// ... one line per icon — tree-shaken automatically

// 4. Usage in a component — themed, typed, tree-shaken
import type { IIcon } from '@old-st/ui';
import { UserIcon } from '@old-st/ui';

// Accept any icon from the set via the shared interface
interface AvatarProps { icon?: IIcon; name: string }

function Avatar({ icon: Icon = UserIcon, name }: AvatarProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={20} className="text-muted-foreground" /> {/* themed via currentColor */}
      <span>{name}</span>
    </div>
  );
}

// ✅ Changing the colour: className="text-primary" — no SVG edit needed
// ✅ Dark mode: text-muted-foreground resolves to the dark token automatically
// ✅ Tree-shaken: only UserIcon lands in the bundle if that's the only import`,

    pitfalls: [
        "<strong>Don't write components before the token pipeline is live.</strong> The first component that uses <code>bg-[#4f46e5]</code> creates a precedent — every component after it will do the same. Tokens first, always.",
        "<strong>Don't regenerate tokens by hand.</strong> Run <code>pnpm tokens:gen</code> after any change to <code>tokens.ts</code>. The CSS file is generated output — it should never be edited directly.",
        "<strong>Don't import <code>darkColors</code> in webapp components.</strong> Web components use Tailwind utilities (<code>dark:bg-card</code>); only mobile imports <code>darkColors</code> directly from <code>@old-st/design-tokens</code>. Importing the TS map in a web component bypasses the CSS variable layer.",
        "<strong>Don't inline SVGR output as JSX in a component file.</strong> Run the CLI once, commit the generated files, then import from the icons barrel. Re-run the CLI whenever icons change — regenerating is idempotent.",
        "<strong>Don't implement Figma pages before all required primitives exist.</strong> The <code>/figma-page</code> workflow will flag missing primitives — complete those first via <code>/figma-component</code>, then continue. Skipping this produces page components that duplicate primitive logic.",
        "<strong>Don't accept raw hex values from <code>get_design_context</code> output.</strong> The design context returns loosely structured code as a reference. Every colour must map to a token utility. If a colour is not in the token map, add it before wiring the component.",
    ],
};
