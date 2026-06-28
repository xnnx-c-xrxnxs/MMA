// Infrastructure — framework-agnostic (pure fetch + Zod, zero React dependency)
//
// Narrowed for the base template: only universal clients (auth, file, base)
// are exported. Example-domain clients (user, product, order) live in
// `@mma/client-common-examples` (see [examples/packages/client-common-examples](examples/packages/client-common-examples)).
export {
  authApiClient
} from './api-clients/auth-api.client';
export {
  type SignUpMockInput,
  type SignUpMockResponse
} from './api-clients/auth-sign-up.mock.client';
export {
  apiRequest,
  apiRequestVoid,
  setAccessTokenGetter,
  setOnUnauthorized
} from './api-clients/base-api.client';
export {
  fileApiClient,
  type PresignedDownloadResponse,
  type PresignedUploadResponse
} from './api-clients/file-api.client';
export { configureApi, getApiConfig } from './config';
export { ApiError } from './errors/api-error';
