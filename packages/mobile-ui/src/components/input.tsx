import React from 'react';
import { TextInput, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radii, fontSizes, spacing } from '../lib/theme';

export interface InputProps extends TextInputProps {
  containerStyle?: ViewStyle;
}

export function Input({ style, containerStyle, ...props }: InputProps) {
  return (
    <TextInput
      style={[styles.input, containerStyle, style]}
      placeholderTextColor={colors.mutedForeground}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
});
