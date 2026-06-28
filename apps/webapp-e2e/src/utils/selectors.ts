/**
 * Centralized data-testid selectors for webapp E2E tests.
 *
 * Base-template surface only. Domain-specific selectors (users, products,
 * orders, categories) live in
 * `examples/apps/webapp-e2e/src/utils/selectors.ts`.
 *
 * These must match the data-testid attributes in the webapp components.
 */

// Layout
export const SIDEBAR = 'sidebar';
export const SIDEBAR_LINK = (label: string) => `sidebar-link-${label.toLowerCase()}`;

// Auth
export const SIGN_IN_FORM = 'sign-in-form';
export const EMAIL_INPUT = 'email-input';
export const PASSWORD_INPUT = 'password-input';
export const SUBMIT_BTN = 'submit-btn';

// Generic dashboard
export const PAGINATION_INFO = 'pagination-info';
