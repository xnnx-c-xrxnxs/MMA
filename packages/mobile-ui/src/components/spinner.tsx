import React from 'react';
import { ActivityIndicator, View, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../lib/theme';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  label?: string;
  style?: ViewStyle;
}

const sizeMap: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 40,
};

export function Spinner({
  size = 'md',
  color = colors.brand,
  label = 'Loading',
  style,
}: SpinnerProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.container, style]}
    >
      <ActivityIndicator size={sizeMap[size]} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
