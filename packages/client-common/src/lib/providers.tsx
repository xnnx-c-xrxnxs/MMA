'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from './query-client';
import { configureApi } from '../infrastructure/config';
import { AuthProvider } from './auth-provider';
import type { TokenStorage } from './token-storage';

export interface ProvidersProps {
  children: React.ReactNode;
  apiConfig?: Parameters<typeof configureApi>[0];
  /**
   * Optional platform-aware storage adapter. Web leaves this undefined
   * (refresh tokens live in httpOnly cookies). Mobile passes a
   * SecureStoreTokenStorage adapter so the cached user survives cold starts.
   */
  tokenStorage?: TokenStorage;
}

export function Providers({ children, apiConfig, tokenStorage }: ProvidersProps) {
  const queryClient = getQueryClient();

  // Configure API URLs once — allows each framework to pass its own
  // env vars (Next.js NEXT_PUBLIC_*, Vite import.meta.env, etc.)
  if (apiConfig) {
    configureApi(apiConfig);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider tokenStorage={tokenStorage}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
