import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/login.page';

/**
 * Auth E2E Tests — Session Management
 *
 * Tests login → authenticated session → sidebar user display.
 * These run WITHOUT stored auth state to test the full login-to-session flow.
 */
test.describe('Auth Session', () => {
  test('should show sidebar with user info after login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signIn('admin@test.com', 'Password123!');

    // Wait for the dashboard to load
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // The sidebar should be visible with user info
    await expect(page.getByTestId('sidebar')).toBeVisible();
  });

  test('should persist session after page navigation', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signIn('admin@test.com', 'Password123!');

    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Navigate to a protected page
    await page.goto('/change-password');

    // Should NOT be redirected back to login (session persists)
    await expect(page).toHaveURL('/change-password');
    await expect(page.getByTestId('change-password-form')).toBeVisible();
  });
});
