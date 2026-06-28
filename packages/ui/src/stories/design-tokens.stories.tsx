/**
 * Design Tokens — visual reference for all token values.
 *
 * Imported from packages/design-tokens via a relative path so Vite resolves
 * it without requiring nxViteTsPaths() in the Storybook Vite config.
 *
 * Sidebar: Design Tokens / Colors | Spacing | Typography
 */
import type { Meta, StoryObj } from '@storybook/react';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  darkColors,
  fontFamilies,
  fontSizes,
  lightColors,
  radii,
  spacing,
} from '../../../design-tokens/src';

// ── Types ─────────────────────────────────────────────────────────────────────

type ColorMap = Record<string, string>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCALE_PREFIXES = ['brand', 'gray', 'success', 'warning', 'danger'] as const;

/** Extracts and sorts numeric-step entries for a given palette prefix. */
function scaleEntries(colors: ColorMap, prefix: string): [string, string][] {
  return Object.entries(colors)
    .filter(([k]) => k.startsWith(prefix) && /\d$/.test(k))
    .sort((a, b) => {
      const n = (k: string) => parseInt(k.replace(prefix, ''), 10);
      return n(a[0]) - n(b[0]);
    });
}

/** Returns semantic alias entries (non-scale keys). */
function semanticEntries(colors: ColorMap): [string, string][] {
  return Object.entries(colors).filter(
    ([k]) => !SCALE_PREFIXES.some((p) => k.startsWith(p) && /\d$/.test(k)),
  );
}

// ── Local components ──────────────────────────────────────────────────────────

function Swatch({ step, hex }: { step: string; hex: string }) {
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 56 }}>
      <div
        className="h-10 w-10 rounded-md border border-border shadow-sm"
        style={{ backgroundColor: hex }}
      />
      <span className="text-center font-mono text-[10px] leading-tight text-muted-foreground">
        {step}
      </span>
      <span className="text-center font-mono text-[9px] leading-tight text-muted-foreground">
        {hex.toLowerCase()}
      </span>
    </div>
  );
}

function PaletteSection({ label, colors, prefix }: { label: string; colors: ColorMap; prefix: string }) {
  const steps = scaleEntries(colors, prefix);
  return (
    <div className="mb-8">
      <p className="mb-3 text-sm font-semibold capitalize text-foreground">{label}</p>
      <div className="flex flex-wrap gap-3">
        {steps.map(([key, hex]) => (
          <Swatch key={key} step={key.replace(prefix, '')} hex={hex} />
        ))}
      </div>
    </div>
  );
}

function SemanticRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-1.5 last:border-0">
      <div
        className="h-5 w-5 shrink-0 rounded border border-border"
        style={{ backgroundColor: value }}
      />
      <span className="w-48 shrink-0 font-mono text-sm text-foreground">{name}</span>
      <span className="font-mono text-xs text-muted-foreground">{value.toLowerCase()}</span>
    </div>
  );
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Design Tokens',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

// ── Stories ───────────────────────────────────────────────────────────────────

export const LightPalettes: Story = {
  name: 'Tier 1 — Numeric Scales (light)',
  render: () => (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="mb-1 text-xl font-bold">Numeric Scales — light</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Raw palette. Synced from Figma via{' '}
        <code className="font-mono">pnpm tokens:sync</code>.
      </p>
      {SCALE_PREFIXES.map((prefix) => (
        <PaletteSection key={prefix} label={prefix} colors={lightColors} prefix={prefix} />
      ))}
    </div>
  ),
};

export const DarkPalettes: Story = {
  name: 'Tier 1 — Numeric Scales (dark)',
  render: () => (
    <div className="dark min-h-screen bg-background p-8 text-foreground">
      <h1 className="mb-1 text-xl font-bold">Numeric Scales — dark</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Only <strong>gray</strong> has distinct dark-mode values; other palettes are shared.
      </p>
      {SCALE_PREFIXES.map((prefix) => (
        <PaletteSection key={prefix} label={prefix} colors={darkColors} prefix={prefix} />
      ))}
    </div>
  ),
};

export const SemanticAliases: Story = {
  name: 'Tier 2 — Semantic Aliases',
  render: () => {
    const lightSemantic = semanticEntries(lightColors);
    const darkSemantic = semanticEntries(darkColors);
    return (
      <div className="flex min-h-screen gap-0">
        {/* Light */}
        <div className="flex-1 bg-background p-8">
          <h2 className="mb-1 text-base font-semibold text-foreground">Light mode</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {lightSemantic.length} aliases
          </p>
          <div className="rounded-lg border border-border bg-card p-4">
            {lightSemantic.map(([key, value]) => (
              <SemanticRow key={key} name={key} value={value} />
            ))}
          </div>
        </div>
        {/* Dark */}
        <div className="dark flex-1 bg-background p-8">
          <h2 className="mb-1 text-base font-semibold text-foreground">Dark mode</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {darkSemantic.length} aliases
          </p>
          <div className="rounded-lg border border-border bg-card p-4">
            {darkSemantic.map(([key, value]) => (
              <SemanticRow key={key} name={key} value={value} />
            ))}
          </div>
        </div>
      </div>
    );
  },
};

// ── Spacing ───────────────────────────────────────────────────────────────────

export const SpacingScale: Story = {
  name: 'Spacing',
  render: () => (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="mb-8 text-xl font-bold">Spacing</h1>
      <div className="space-y-4">
        {Object.entries(spacing).map(([key, px]) => (
          <div key={key} className="flex items-center gap-4">
            <span className="w-10 font-mono text-sm text-foreground">{key}</span>
            <div className="h-4 rounded bg-brand-500" style={{ width: px }} />
            <span className="font-mono text-xs text-muted-foreground">{px}px</span>
          </div>
        ))}
      </div>
    </div>
  ),
};

// ── Typography ────────────────────────────────────────────────────────────────

export const TypographyScale: Story = {
  name: 'Typography',
  render: () => (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <h1 className="mb-8 text-xl font-bold">Typography</h1>

      {/* Font sizes */}
      <section className="mb-12">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Font Sizes
        </h2>
        <div className="space-y-6">
          {Object.entries(fontSizes).map(([key, px]) => (
            <div key={key} className="flex items-baseline gap-6">
              <span className="w-10 shrink-0 font-mono text-sm text-muted-foreground">{key}</span>
              <span className="text-foreground" style={{ fontSize: px, lineHeight: 1.4 }}>
                The quick brown fox ({px}px)
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Radii */}
      <section className="mb-12">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Radii
        </h2>
        <div className="flex flex-wrap gap-8">
          {Object.entries(radii).map(([key, px]) => (
            <div key={key} className="flex flex-col items-center gap-2">
              <div
                className="h-16 w-16 border-2 border-brand-500 bg-brand-100"
                style={{ borderRadius: px }}
              />
              <span className="font-mono text-sm text-foreground">{key}</span>
              <span className="font-mono text-xs text-muted-foreground">{px}px</span>
            </div>
          ))}
        </div>
      </section>

      {/* Font families */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Font Families
        </h2>
        <div className="space-y-3">
          {Object.entries(fontFamilies).map(([key, stack]) => (
            <div key={key} className="rounded-md border border-border bg-card p-3">
              <span className="font-mono text-sm font-semibold text-foreground">{key}: </span>
              <span className="break-all font-mono text-xs text-muted-foreground">{stack}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  ),
};


