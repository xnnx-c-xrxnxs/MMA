import React from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, fontSizes } from '../lib/theme';

export type TextVariant = 'body' | 'caption' | 'heading' | 'subheading' | 'muted';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
}

const variantStyles: Record<TextVariant, TextStyle> = {
  body: { fontSize: fontSizes.sm, color: colors.foreground },
  caption: { fontSize: fontSizes.xs, color: colors.mutedForeground },
  heading: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.foreground },
  subheading: { fontSize: fontSizes.lg, fontWeight: '600', color: colors.foreground },
  muted: { fontSize: fontSizes.sm, color: colors.mutedForeground },
};

export function Text({ variant = 'body', style, ...props }: TextProps) {
  return <RNText style={[styles.base, variantStyles[variant], style]} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: undefined, // uses system default
  },
});
