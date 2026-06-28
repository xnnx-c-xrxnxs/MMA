import { test as setup, expect } from '@playwright/test';
import path from 'path';

/**
 * Playwright global auth setup.
 *
 * Authenticates via the login page and saves the browser state (cookies + localStorage)
 * so all downstream tests run as an authenticated user. This is Playwright's recommended
 * pattern for apps with an auth wall.
 *
 * @see https://playwright.dev/docs/auth
 */

export const STORAGE_STATE = path.join(__dirname, '../../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to the login page
  await page.goto('/auth/login');

  // Fill in the login form with local provider credentials
  await page.getByTestId('email-input').fill('admin@test.com');
  await page.getByTestId('password-input').fill('Password123!');
  await page.getByTestId('sign-in-btn').click();

  // Wait for redirect to dashboard after successful login
  await expect(page).toHaveURL('/', { timeout: 10000 });

  // Save the authenticated browser state
  await page.context().storageState({ path: STORAGE_STATE });
});
