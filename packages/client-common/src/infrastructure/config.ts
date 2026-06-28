interface ApiConfig {
  userApiUrl: string;
  productApiUrl: string;
  orderApiUrl: string;
  authApiUrl: string;
  fileApiUrl: string;
  // TEMPORARY: used only by mock clients during backend gaps.
  // Remove when mocked endpoints are replaced by real services.
  mockApiUrl: string;
}

const defaults: ApiConfig = {
  userApiUrl: 'http://localhost:3000/api',
  productApiUrl: 'http://localhost:3001/api',
  orderApiUrl: 'http://localhost:3002/api',
  authApiUrl: 'http://localhost:3003/api',
  fileApiUrl: 'http://localhost:3004/api',
  mockApiUrl: 'http://localhost:4200',
};

let current: ApiConfig = { ...defaults };

/**
 * Configure base URLs for all API clients.
 * Call once at app startup, before any API calls.
 *
 * @example
 * // Next.js — in layout.tsx or providers.tsx
 * configureApi({
 *   userApiUrl: process.env.NEXT_PUBLIC_API_USER_URL!,
 *   productApiUrl: process.env.NEXT_PUBLIC_API_PRODUCT_URL!,
 *   orderApiUrl: process.env.NEXT_PUBLIC_API_ORDER_URL!,
 * });
 *
 * @example
 * // Vite/Vue — in main.ts
 * configureApi({
 *   userApiUrl: import.meta.env.VITE_API_USER_URL,
 *   productApiUrl: import.meta.env.VITE_API_PRODUCT_URL,
 *   orderApiUrl: import.meta.env.VITE_API_ORDER_URL,
 * });
 */
export function configureApi(overrides: Partial<ApiConfig>): void {
  current = { ...current, ...overrides };
}

export function getApiConfig(): Readonly<ApiConfig> {
  return current;
}
