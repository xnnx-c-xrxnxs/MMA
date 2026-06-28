import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureApi, AuthProvider } from '@old-st/client-common';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { createSecureTokenStorage } from '../lib/secure-storage';

// Hold the splash screen until the JS root mounts so we don't flash
// the login screen on cold start.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Initialise Sentry as early as possible. DSN comes from EAS env / app.config.ts.
const extra = Constants.expoConfig?.extra ?? {};
const sentryDsn =
  (extra.sentryDsn as string | undefined) ?? process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    debug: __DEV__,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    environment: (extra.appEnv as string | undefined) ?? 'development',
  });
}

// Configure API base URLs — read from app.config.ts `extra` (build-time env)
// with safe localhost fallbacks for the dev client.
configureApi({
  userApiUrl:
    (extra.apiUserUrl as string | undefined) ??
    process.env.EXPO_PUBLIC_API_USER_URL ??
    'http://localhost:3000/api',
  productApiUrl:
    (extra.apiProductUrl as string | undefined) ??
    process.env.EXPO_PUBLIC_API_PRODUCT_URL ??
    'http://localhost:3001/api',
  orderApiUrl:
    (extra.apiOrderUrl as string | undefined) ??
    process.env.EXPO_PUBLIC_API_ORDER_URL ??
    'http://localhost:3002/api',
  authApiUrl:
    (extra.apiAuthUrl as string | undefined) ??
    process.env.EXPO_PUBLIC_API_AUTH_URL ??
    'http://localhost:3003/api',
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const tokenStorage = createSecureTokenStorage();

function RootLayout() {
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => undefined);
    }, 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider tokenStorage={tokenStorage}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

// Wrap with Sentry's error boundary so JS errors and native crashes are reported.
export default sentryDsn ? Sentry.wrap(RootLayout) : RootLayout;
