import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './text';
import { Button } from './button';
import { colors, spacing } from '../lib/theme';

/**
 * Class-based error boundary for React Native screens.
 *
 * Wrap a screen tree with `<ErrorBoundary>` to catch render errors. When the
 * sentry DSN is configured at app boot the root is already wrapped by
 * `Sentry.wrap()`, but per-screen boundaries give the user a recoverable UI
 * instead of a frozen white screen.
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback renderer. Default = simple "Try again" card. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Optional hook for logging — called whenever an error is captured. */
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <View style={styles.container} testID="error-boundary-fallback">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{error.message}</Text>
        <View style={styles.actions}>
          <Button onPress={this.reset}>Try again</Button>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
});
