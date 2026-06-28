// @old-st/client-common — base-template public surface
//
// This package ships only the cross-domain universals (auth, file uploads,
// the API request infrastructure, the QueryClient + Providers + AuthProvider).
//
// Example-domain hooks and clients (users, products, orders, categories)
// live in `@old-st/client-common-examples` under `examples/`.

// Infrastructure — framework-agnostic (zero React dependency)
export {
  ApiError,
  apiRequest,
  apiRequestVoid,
  authApiClient,
  configureApi,
  fileApiClient,
  getApiConfig,
  setAccessTokenGetter,
  setOnUnauthorized,
  type PresignedDownloadResponse,
  type PresignedUploadResponse,
  type SignUpMockInput,
  type SignUpMockResponse
} from './infrastructure';

// Hooks — React Query (requires React + @tanstack/react-query)
export {
  optimisticMutation,
  useChangePassword,
  useCompleteNewPassword,
  useConfirmForgotPassword,
  useCurrentUser,
  useFileUpload,
  useForgotPassword,
  useRefreshSession,
  useSignIn,
  useSignOut,
  useSignUp,
  type FileUploadStatus,
  type OptimisticMutationOptions,
  type UseFileUploadResult
} from './hooks';

// Lib — Query client & Providers
export { AuthProvider, useAuth } from './lib/auth-provider';
export { Providers } from './lib/providers';
export { getQueryClient, makeQueryClient } from './lib/query-client';
export {
  TOKEN_STORAGE_KEYS,
  noopTokenStorage,
  type TokenStorage
} from './lib/token-storage';

// Lib — Status formatting (universal helper only; per-domain wrappers in
// [examples/packages/client-common-examples](examples/packages/client-common-examples))
export { formatStatus } from './lib/format-status';

// Lib — Date/time formatting (UTC → display timezone, shared by webapp + mobile)
export { DEFAULT_TIMEZONE, formatDate, formatDateTime, formatTime } from './lib/format-date';
