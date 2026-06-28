/**
 * @mma/design-tokens — public barrel.
 *
 * Web consumers: import `tokens.css` via the subpath export
 *   `@mma/design-tokens/tokens.css` (or its resolved path) in globals.css.
 *   Do NOT import JS token values into web components — use Tailwind semantic
 *   utilities (bg-primary, text-foreground) that resolve against CSS variables.
 *
 * Mobile consumers: import JS values directly.
 *   import { lightColors, darkColors, spacing } from '@mma/design-tokens';
 */
export {
  lightColors,
  darkColors,
  spacing,
  radii,
  fontSizes,
  fontFamilies,
  tokens,
  type ColorTokens,
} from './lib/tokens';
