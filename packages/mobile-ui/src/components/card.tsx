import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { colors, radii, spacing, fontSizes } from '../lib/theme';

/* ─── Card ─── */

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ─── CardHeader ─── */

export interface CardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardHeader({ children, style }: CardHeaderProps) {
  return <View style={[styles.cardHeader, style]}>{children}</View>;
}

/* ─── CardTitle ─── */

export interface CardTitleProps {
  children: React.ReactNode;
  style?: TextStyle;
}

export function CardTitle({ children, style }: CardTitleProps) {
  return <Text style={[styles.cardTitle, style]}>{children}</Text>;
}

/* ─── CardContent ─── */

export interface CardContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardContent({ children, style }: CardContentProps) {
  return <View style={[styles.cardContent, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.cardForeground,
  },
  cardContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
