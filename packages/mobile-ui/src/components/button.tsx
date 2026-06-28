import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  ActivityIndicator,
} from 'react-native';
import { colors, radii, fontSizes, spacing } from '../lib/theme';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'brand';
export type ButtonSize = 'default' | 'sm' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const variantStyles: Record<ButtonVariant, { container: ViewStyle; textColor: string }> = {
  default: { container: { backgroundColor: colors.primary }, textColor: colors.primaryForeground },
  destructive: { container: { backgroundColor: colors.destructive }, textColor: colors.destructiveForeground },
  outline: { container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }, textColor: colors.foreground },
  secondary: { container: { backgroundColor: colors.secondary }, textColor: colors.secondaryForeground },
  ghost: { container: { backgroundColor: 'transparent' }, textColor: colors.foreground },
  brand: { container: { backgroundColor: colors.brand }, textColor: colors.brandForeground },
};

const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  default: { container: { height: 44, paddingHorizontal: spacing.lg }, text: { fontSize: fontSizes.sm } },
  sm: { container: { height: 36, paddingHorizontal: spacing.md }, text: { fontSize: fontSizes.xs } },
  lg: { container: { height: 52, paddingHorizontal: spacing.xl }, text: { fontSize: fontSizes.md } },
};

export function Button({
  variant = 'default',
  size = 'default',
  children,
  onPress,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.container,
        v.container,
        s.container,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.textColor} size="small" />
      ) : (
        <Text style={[styles.text, s.text, { color: v.textColor }]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  text: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
