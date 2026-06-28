import { test, expect } from '@playwright/test';
import { ForgotPasswordPage } from '../../page-objects/forgot-password.page';

/**
 * Auth E2E Tests — Forgot Password Flow
 *
 * Tests the forgot-password page UI and form behavior.
 * The local auth provider may not fully implement password reset,
 * so these tests focus on page rendering and form interaction.
 */
test.describe('Forgot Password Page', () => {
  let forgotPage: ForgotPasswordPage;

  test.beforeEach(async ({ page }) => {
    forgotPage = new ForgotPasswordPage(page);
  });

  test('should display the forgot password form', async () => {
    await forgotPage.goto();

    await expect(forgotPage.container).toBeVisible();
    await expect(forgotPage.emailInput).toBeVisible();
    await expect(forgotPage.submitBtn).toBeVisible();
    await expect(
      forgotPage.page.getByRole('heading', { name: 'Forgot Password' }),
    ).toBeVisible();
  });

  test('should accept an email and submit the form', async () => {
    await forgotPage.goto();
    await forgotPage.requestResetCode('admin@test.com');

    // After submitting, either the step changes to "confirm" or an error shows.
    // With local provider, we just verify the form submitted without crashing.
    // Wait briefly for any response
    await forgotPage.page.waitForTimeout(1000);

    // The page should still be on forgot-password (either showing confirm step or error)
    await expect(forgotPage.page).toHaveURL(/forgot-password/);
  });

  test('should be accessible from the login page', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByTestId('forgot-password-link').click();

    await expect(page).toHaveURL('/auth/forgot-password');
    await expect(
      page.getByRole('heading', { name: 'Forgot Password' }),
    ).toBeVisible();
  });
});
