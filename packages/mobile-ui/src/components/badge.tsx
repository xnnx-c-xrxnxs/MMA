import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii, fontSizes, spacing } from '../lib/theme';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'brand'
  | 'danger';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: ViewStyle;
}

const variantStyles: Record<BadgeVariant, { container: ViewStyle; textColor: string }> = {
  default: { container: { backgroundColor: colors.primary }, textColor: colors.primaryForeground },
  secondary: { container: { backgroundColor: colors.secondary }, textColor: colors.secondaryForeground },
  destructive: { container: { backgroundColor: colors.destructive }, textColor: colors.destructiveForeground },
  outline: { container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }, textColor: colors.foreground },
  success: { container: { backgroundColor: colors.successBg }, textColor: colors.successText },
  warning: { container: { backgroundColor: colors.warningBg }, textColor: colors.warningText },
  brand: { container: { backgroundColor: colors.brandSubtle }, textColor: colors.brand },
  danger: { container: { backgroundColor: colors.dangerBg }, textColor: colors.dangerText },
};

export function Badge({ variant = 'default', children, style }: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <View style={[styles.container, v.container, style]}>
      <Text style={[styles.text, { color: v.textColor }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
});
