import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../lib/theme';

/* ─── Separator / Divider ─── */

export interface SeparatorProps {
  style?: ViewStyle;
}

export function Separator({ style }: SeparatorProps) {
  return <View style={[styles.separator, style]} />;
}

const styles = StyleSheet.create({
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
});
