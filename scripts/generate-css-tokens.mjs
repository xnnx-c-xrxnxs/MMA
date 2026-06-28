#!/usr/bin/env node
/**
 * Generate the @theme + .dark blocks in packages/design-tokens/src/lib/tokens.css from
 * packages/design-tokens/src/lib/tokens.ts. Run via `pnpm tokens:gen`.
 *
 * Contract:
 *   - tokens.ts is the single source of truth.
 *   - The output file (`tokens.css`) is FULLY managed — its entire body is
 *     the AUTO-GENERATED block. Both `apps/webapp/src/app/globals.css` and
 *     `packages/ui/.storybook/preview.css` `@import` it so Tailwind v4's
 *     `@theme` registration happens once, and Storybook + webapp stay in
 *     lockstep.
 *   - `tokens.css` deliberately contains NO `@source` / `@custom-variant`
 *     declarations — those are nested-import errors in Tailwind v4. Both
 *     consumers declare their own `@source` / `@custom-variant` lines.
 *   - CI (ci-fast-check.yml) runs this script and fails if `git diff` is
 *     non-empty — prevents drift.
 *
 * Mapping rules:
 *   - camelCase token name → kebab-case CSS variable: `cardForeground` → `--color-card-foreground`
 *   - Numeric scales: `brand600` → `--color-brand-600` (number gets a dash)
 *   - Radii from `radii` → `--radius-{key}` in the @theme block only
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ──────────────────────────────────────────────────────────────────────────
// Load tokens.ts at runtime via a tsx-free dynamic import workaround.
// The file is ESM-friendly TS — we strip type-only syntax with a tiny regex
// and eval the resulting JS. Avoids adding ts-node/tsx/esbuild as a dep.
// ──────────────────────────────────────────────────────────────────────────
const tokensPath = resolve(ROOT, 'packages/design-tokens/src/lib/tokens.ts');
const tokensSource = readFileSync(tokensPath, 'utf8');

// Strip the `as const` assertions, type aliases, and `export type` lines.
// Replace `export const` with `const` so we can capture via `eval`.
const stripped = tokensSource
  .replace(/export type [^;]+;?/g, '')
  .replace(/\bas const\b/g, '')
  .replace(/export const tokens[\s\S]*?\} as const;/, '')
  .replace(/export const /g, 'const ');

// Wrap in an IIFE that returns the named exports.
const wrapped = `${stripped}
return { lightColors, darkColors, spacing, radii, fontSizes, fontFamilies };`;

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const exec = new Function(wrapped);
const { lightColors, darkColors, spacing, radii, fontSizes, fontFamilies } = exec();

// ──────────────────────────────────────────────────────────────────────────
// Format helpers
// ──────────────────────────────────────────────────────────────────────────

/** camelCase → kebab-case, with a dash before any digit run. */
function toCssVar(name) {
  return name
    // insert dash before uppercase letters
    .replace(/([A-Z])/g, '-$1')
    // insert dash before digit groups (e.g. brand600 → brand-600)
    .replace(/([a-z])(\d)/g, '$1-$2')
    .toLowerCase();
}

function colorBlock(palette, indent = '  ') {
  return Object.entries(palette)
    .map(([key, val]) => `${indent}--color-${toCssVar(key)}: ${val};`)
    .join('\n');
}

function radiusBlock(scale, indent = '  ') {
  return Object.entries(scale)
    .map(([key, val]) => {
      // numbers in tokens.ts are pixels; emit as rem
      const rem = typeof val === 'number' ? `${val / 16}rem` : val;
      return `${indent}--radius-${key}: ${rem};`;
    })
    .join('\n');
}

function fontFamilyBlock(families, indent = '  ') {
  return Object.entries(families)
    .map(([key, val]) => `${indent}--font-${key}: ${val};`)
    .join('\n');
}

function spacingBlock(scale, indent = '  ') {
  return Object.entries(scale)
    .map(([key, val]) => {
      const rem = typeof val === 'number' ? `${val / 16}rem` : val;
      return `${indent}--spacing-${key}: ${rem};`;
    })
    .join('\n');
}

function fontSizeBlock(scale, indent = '  ') {
  return Object.entries(scale)
    .map(([key, val]) => {
      const rem = typeof val === 'number' ? `${val / 16}rem` : val;
      return `${indent}--text-${key}: ${rem};`;
    })
    .join('\n');
}

// ──────────────────────────────────────────────────────────────────────────
// Build the generated section
// ──────────────────────────────────────────────────────────────────────────

const START = '/* AUTO-GENERATED:tokens START — do not edit by hand. Run `pnpm tokens:gen`. */';
const END = '/* AUTO-GENERATED:tokens END */';

const generated = `${START}
@theme {
${colorBlock(lightColors)}
${radiusBlock(radii)}
${spacingBlock(spacing)}
${fontSizeBlock(fontSizes)}
${fontFamilyBlock(fontFamilies)}
}

.dark {
${colorBlock(darkColors)}
}
${END}`;

// ──────────────────────────────────────────────────────────────────────────
// Splice into tokens.css — the file is FULLY managed; we overwrite its
// entire contents with the generated block (no surrounding sentinels needed
// because nothing else lives in this file).
// ──────────────────────────────────────────────────────────────────────────

const cssPath = resolve(ROOT, 'packages/design-tokens/src/lib/tokens.css');
const css = readFileSync(cssPath, 'utf8');

const next = `${generated}\n`;

if (next === css) {
  console.log('tokens:gen — no changes');
} else {
  writeFileSync(cssPath, next, 'utf8');
  console.log(`tokens:gen — wrote ${cssPath}`);
}
