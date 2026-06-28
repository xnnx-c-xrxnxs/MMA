import React from 'react';
import { Pressable, View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../lib/theme';

export interface ListRowProps {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function ListRow({
  leading,
  trailing,
  children,
  selected = false,
  onPress,
  style,
}: ListRowProps) {
  const Content = (
    <View
      style={[
        styles.container,
        selected ? styles.selected : styles.default,
        style,
      ]}
    >
      {leading != null && <View style={styles.leading}>{leading}</View>}
      <View style={styles.content}>{children}</View>
      {trailing != null && <View style={styles.trailing}>{trailing}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        {({ pressed }) => (
          <View style={pressed ? styles.pressed : null}>{Content}</View>
        )}
      </Pressable>
    );
  }
  return Content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  default: {
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  selected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSubtle,
  },
  leading: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
  trailing: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
