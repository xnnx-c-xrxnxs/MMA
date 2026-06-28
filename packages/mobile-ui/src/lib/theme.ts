/**
 * Mobile theme — re-exports the cross-platform tokens from @old-st/ui so
 * native components stay 1:1 with web. Web uses CSS variables (Tailwind v4);
 * mobile uses these JS objects directly via StyleSheet.create() or inline.
 *
 * Theme switching example:
 *   import { useColorScheme } from 'react-native';
 *   import { lightColors, darkColors } from '@old-st/mobile-ui';
 *   const palette = useColorScheme() === 'dark' ? darkColors : lightColors;
 *   <View style={{ backgroundColor: palette.card }} />
 *
 * The legacy `colors` export below remains for backwards compatibility
 * with existing primitives. New screens should use lightColors/darkColors.
 */

export {
  lightColors,
  darkColors,
  spacing,
  radii,
  fontSizes,
  type ColorTokens,
} from '@old-st/design-tokens';

import { lightColors } from '@old-st/design-tokens';

// Legacy alias — points at lightColors for back-compat.
export const colors = lightColors;
