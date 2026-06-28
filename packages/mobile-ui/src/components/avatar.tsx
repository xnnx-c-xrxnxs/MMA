import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii, fontSizes } from '../lib/theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

const sizeStyles: Record<AvatarSize, { container: ViewStyle; text: number }> = {
  sm: { container: { width: 28, height: 28 }, text: fontSizes.xs },
  md: { container: { width: 40, height: 40 }, text: fontSizes.sm },
  lg: { container: { width: 56, height: 56 }, text: fontSizes.md },
};

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 'md', style }: AvatarProps) {
  const s = sizeStyles[size];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[styles.container, s.container, style]}
    >
      <Text style={[styles.text, { fontSize: s.text }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.brand,
    fontWeight: '600',
  },
});
