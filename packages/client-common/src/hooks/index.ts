// React Query hooks — requires React + @tanstack/react-query
//
// Narrowed for the base template: only universal hooks (auth, file upload,
// optimistic mutation helper) are exported. Example-domain hooks (use-users,
// use-products, use-orders, use-infinite for users/products) live in
// `@old-st/client-common-examples` (see [examples/packages/client-common-examples](examples/packages/client-common-examples)).
export {
  useChangePassword,
  useCompleteNewPassword,
  useConfirmForgotPassword,
  useCurrentUser,
  useForgotPassword,
  useRefreshSession,
  useSignIn,
  useSignOut,
  useSignUp
} from './use-auth';

export {
  optimisticMutation,
  type OptimisticMutationOptions
} from './optimistic-mutation';

export {
  useFileUpload,
  type FileUploadStatus,
  type UseFileUploadResult
} from './use-file-upload';
