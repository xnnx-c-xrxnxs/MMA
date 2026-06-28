import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii, spacing, fontSizes } from '../lib/theme';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      {icon != null && <View style={styles.icon}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action != null && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 320,
  },
  action: {
    marginTop: spacing.sm,
  },
});
