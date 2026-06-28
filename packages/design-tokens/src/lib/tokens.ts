/**
 * Shared design tokens — single source of truth for colors, spacing, radii,
 * typography across @mma/ui (web) and @mma/mobile-ui (React Native).
 *
 * ─── Two-tier color model ──────────────────────────────────────────────────
 *
 *   Tier 1 — NUMERIC SCALES (brand50..brand950, gray50..gray950, etc.)
 *     The raw palette. Sourced from the Figma library swatches.
 *     Use these directly when a design needs a specific shade
 *     (e.g. `bg-brand-100` for a tinted info panel).
 *
 *   Tier 2 — SEMANTIC ALIASES (primary, muted, destructive, etc.)
 *     Map onto a specific scale step per theme. Use these in 95% of cases —
 *     they auto-adapt to dark mode and keep components portable.
 *
 *   Example:
 *     ❌  bg-[#7f56d9]            // raw hex — forbidden
 *     ⚠️  bg-brand-600            // scale step — OK when shade matters
 *     ✅  bg-primary              // semantic — preferred default
 *
 * ─── Sync rules ────────────────────────────────────────────────────────────
 *
 *   1. Adding a new scale step or semantic alias: update BOTH `lightColors`
 *      and `darkColors` here.
 *   2. Run `pnpm tokens:gen` afterwards. It regenerates the `@theme { ... }`
 *      and `.dark { ... }` blocks in `apps/webapp/src/app/globals.css`
 *      between the auto-generated sentinels. CI fails if you forget.
 *   3. Mobile imports `lightColors` / `darkColors` directly from `@mma/design-tokens`.
 */

// ─── FIGMA:SYNC START — replaced by `pnpm tokens:sync` (scripts/sync-figma-tokens.mjs) ─
// ──────────────────────────────────────────────────────────────────────────
// Tier 1 — Numeric color scales (light theme)
// Source: Figma "Cousteau Design System" — _Primitives collection
// ──────────────────────────────────────────────────────────────────────────

const brandLight = {
  brand25: '#A1D0FF',
  brand50: '#F9F0EB',
  brand100: '#F3D5C7',
  brand200: '#F29D74',
  brand300: '#F77E44',
  brand400: '#FF5F12',
  brand500: '#E74B00',
  brand600: '#BB4208', // canonical brand
  brand700: '#93380C',
  brand800: '#6D2D0E',
  brand900: '#49210E',
  brand950: '#29140A',
} as const;

const grayLight = {
  gray25: '#FDFDFD',
  gray50: '#E3EAF3',
  gray100: '#CBD5E2',
  gray200: '#B1C1D2',
  gray300: '#90A5BB',
  gray400: '#768EA7',
  gray500: '#6C849D',
  gray600: '#58728D',
  gray700: '#40566D',
  gray800: '#2F4256',
  gray900: '#243547',
  gray950: '#192839',
} as const;

const successLight = {
  success25: '#F6FEF9',
  success50: '#EDF7F3',
  success100: '#C8EBDB',
  success200: '#74DDAC',
  success300: '#44DB95',
  success400: '#25C97D',
  success500: '#1D9F63',
  success600: '#217F54',
  success700: '#1E6745',
  success800: '#1A5037',
  success900: '#153929',
  success950: '#0F241A',
} as const;

const warningLight = {
  warning25: '#FFFCF5',
  warning50: '#F9F4EC',
  warning100: '#F2E4CD',
  warning200: '#EDC686',
  warning300: '#EEB95E',
  warning400: '#F3AC33',
  warning500: '#F59E0B',
  warning600: '#CB840C',
  warning700: '#9D6911',
  warning800: '#734F12',
  warning900: '#4C3610',
  warning950: '#281D0B',
} as const;

const dangerLight = {
  danger25: '#FFFBFA',
  danger50: '#F7EDED',
  danger100: '#EED1D1',
  danger200: '#E29292',
  danger300: '#DF6F6F',
  danger400: '#DE4949',
  danger500: '#DC2626',
  danger600: '#B82121',
  danger700: '#8F2020',
  danger800: '#691D1D',
  danger900: '#461717',
  danger950: '#250E0E',
} as const;

const accentLight = {
  accent50: '#F0EBF9',
  accent100: '#D5C7F3',
  accent200: '#9C74F2',
  accent300: '#7D44F7',
  accent400: '#5D12FF',
  accent500: '#4900E7',
  accent600: '#4008BB',
  accent700: '#370C93',
  accent800: '#2C0E6D',
  accent900: '#200E49',
  accent950: '#140A29',
} as const;

const secondaryLight = {
  secondary50: '#EBF5F9',
  secondary100: '#C2E3F2',
  secondary200: '#61C4F4',
  secondary300: '#29B7FC',
  secondary400: '#00A5F5',
  secondary500: '#0085C5',
  secondary600: '#0C6D9C',
  secondary700: '#0E597D',
  secondary800: '#0E455F',
  secondary900: '#0D3243',
  secondary950: '#0A1F29',
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Tier 1 — Numeric color scales (dark theme)
// grayDark uses distinct dark-mode hex values from the Figma dark gray palette.
// All other palettes share the same hex values across themes; semantic aliases
// below remap their meaning by picking different steps per theme.
// ──────────────────────────────────────────────────────────────────────────

const brandDark = brandLight;

const grayDark = {
  grayDark25: '#FAFAFA',
  grayDark50: '#F7F7F7',
  grayDark100: '#F0F0F1',
  grayDark200: '#ECECED',
  grayDark300: '#CECFD2',
  grayDark400: '#94979C',
  grayDark500: '#85888E',
  grayDark600: '#61656C',
  grayDark700: '#373A41',
  grayDark800: '#22262F',
  grayDark900: '#13161B',
  grayDark950: '#0C0E12',
} as const;

const successDark = successLight;
const warningDark = warningLight;
const dangerDark = dangerLight;
const accentDark = accentLight;
const secondaryDark = secondaryLight;

// ──────────────────────────────────────────────────────────────────────────
// Tier 2 — Semantic aliases (light theme)
// ──────────────────────────────────────────────────────────────────────────

export const lightColors = {
  // numeric scales (re-exposed)
  ...brandLight,
  ...grayLight,
  ...successLight,
  ...warningLight,
  ...dangerLight,
  ...accentLight,
  ...secondaryLight,

  // semantic surface
  background: '#ffffff',
  foreground: grayLight.gray900,
  card: '#ffffff',
  cardForeground: grayLight.gray900,
  popover: '#ffffff',
  popoverForeground: grayLight.gray900,
  surface: '#ffffff',
  bgApp: grayLight.gray50,

  // semantic action
  primary: grayLight.gray900,
  primaryForeground: grayLight.gray50,
  secondary: grayLight.gray100,
  secondaryForeground: grayLight.gray900,
  muted: grayLight.gray100,
  mutedForeground: grayLight.gray500,
  accent: grayLight.gray100,
  accentForeground: grayLight.gray900,
  destructive: dangerLight.danger500,
  destructiveForeground: grayLight.gray50,
  border: grayLight.gray300,
  input: grayLight.gray300,
  ring: grayLight.gray950,

  // semantic brand
  brand: brandLight.brand600,
  brandHover: brandLight.brand700,
  brandSubtle: brandLight.brand25,
  brandForeground: '#ffffff',

  // semantic status (legacy names — remapped to scale steps)
  successBg: successLight.success100,
  successText: successLight.success800,
  warningBg: warningLight.warning100,
  warningText: warningLight.warning800,
  successFigBg: successLight.success50,
  successFigText: successLight.success500,
  warningFigBg: warningLight.warning50,
  warningFigText: warningLight.warning500,
  dangerBg: dangerLight.danger50,
  dangerText: dangerLight.danger600,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Tier 2 — Semantic aliases (dark theme)
// ──────────────────────────────────────────────────────────────────────────

export const darkColors = {
  // numeric scales (re-exposed)
  ...brandDark,
  ...accentDark,
  ...secondaryDark,
  gray25: grayDark.grayDark25,
  gray50: grayDark.grayDark50,
  gray100: grayDark.grayDark100,
  gray200: grayDark.grayDark200,
  gray300: grayDark.grayDark300,
  gray400: grayDark.grayDark400,
  gray500: grayDark.grayDark500,
  gray600: grayDark.grayDark600,
  gray700: grayDark.grayDark700,
  gray800: grayDark.grayDark800,
  gray900: grayDark.grayDark900,
  gray950: grayDark.grayDark950,
  ...successDark,
  ...warningDark,
  ...dangerDark,

  // semantic surface
  background: grayDark.grayDark950,
  foreground: grayDark.grayDark50,
  card: grayDark.grayDark900,
  cardForeground: grayDark.grayDark50,
  popover: grayDark.grayDark900,
  popoverForeground: grayDark.grayDark50,
  surface: grayDark.grayDark900,
  bgApp: grayDark.grayDark950,

  // semantic action
  primary: grayDark.grayDark50,
  primaryForeground: grayDark.grayDark900,
  secondary: grayDark.grayDark800,
  secondaryForeground: grayDark.grayDark50,
  muted: grayDark.grayDark800,
  mutedForeground: grayDark.grayDark400,
  accent: grayDark.grayDark800,
  accentForeground: grayDark.grayDark50,
  destructive: dangerDark.danger600,
  destructiveForeground: grayDark.grayDark50,
  border: grayDark.grayDark700,
  input: grayDark.grayDark700,
  ring: grayDark.grayDark300,

  // semantic brand (lift the brand step in dark mode)
  brand: brandDark.brand400,
  brandHover: brandDark.brand300,
  brandSubtle: brandDark.brand900,
  brandForeground: '#ffffff',

  // semantic status (legacy names — remapped)
  successBg: successDark.success900,
  successText: successDark.success200,
  warningBg: warningDark.warning900,
  warningText: warningDark.warning300,
  successFigBg: successDark.success900,
  successFigText: successDark.success200,
  warningFigBg: warningDark.warning900,
  warningFigText: warningDark.warning300,
  dangerBg: dangerDark.danger900,
  dangerText: dangerDark.danger200,
} as const;

export type ColorTokens = typeof lightColors;
// ─── FIGMA:SYNC END ──────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// Overlay / scrim tokens (8-char hex = RRGGBBAA)
// Source: Figma _global → color/black, color/white, color/grey
// Use for modal scrims, gallery backdrops, and overlay controls.
// These are NOT part of the FIGMA:SYNC block — managed manually.
//
// Tailwind equivalent:  bg-black/30  bg-white/75  bg-[#DEECF2]/60
// Use whichever is more readable in context.
// ──────────────────────────────────────────────────────────────────────────
export const overlayTokens = {
  // Black overlays — modal scrims, gallery controls
  blackBase: '#131314',
  blackAlpha30: '#1313144D',
  blackAlpha60: '#13131499',
  blackAlpha75: '#131314BF',

  // White overlays — frosted panels, light backdrops
  whiteBase: '#FFFFFF',
  whiteAlpha30: '#FFFFFF4D',
  whiteAlpha60: '#FFFFFF99',
  whiteAlpha75: '#FFFFFFBF',

  // Grey overlays (blue-grey tint) — gallery backdrops, neutral scrims
  greyBase: '#DEECF2',
  greyAlpha30: '#DEECF24D',
  greyAlpha60: '#DEECF299',
  greyAlpha75: '#DEECF2BF',
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Spacing
// ──────────────────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Radii
// ──────────────────────────────────────────────────────────────────────────
export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Typography
// ──────────────────────────────────────────────────────────────────────────
export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
} as const;

/**
 * Font family stacks. The `sans` and `mono` values include `var(--font-sans)`
 * and `var(--font-mono)` as the FIRST entry — these CSS variables are set on
 * `<html>` by `next/font` (in `apps/webapp/src/app/layout.tsx`). When the
 * variable is missing (Storybook, mobile, RSC fallback), the rest of the
 * stack provides a sensible system default.
 *
 * On mobile (React Native) the `var(--font-sans)` segment is harmless — RN's
 * style system ignores unsupported values and falls back to the next entry.
 */
export const fontFamilies = {
  sans: 'var(--font-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'var(--font-mono), ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as const;

export const tokens = {
  lightColors,
  darkColors,
  spacing,
  radii,
  fontSizes,
  fontFamilies,
} as const;
