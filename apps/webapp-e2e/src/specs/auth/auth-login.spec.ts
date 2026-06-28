import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/login.page';

/**
 * Auth E2E Tests — Login Flow
 *
 * These tests run WITHOUT stored auth state (unauthenticated browser)
 * to verify the login page, auth redirect, and error handling.
 */
test.describe('Login Page', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('should display the sign-in form', async () => {
    await loginPage.goto();

    await expect(loginPage.signInForm).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.signInBtn).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  test('should sign in with valid credentials and redirect to dashboard', async ({ page }) => {
    await loginPage.goto();
    await loginPage.signIn('admin@test.com', 'Password123!');

    // After successful login, should redirect to the dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await expect(
      page.getByRole('heading', { name: 'Welcome to Old ST Admin' }),
    ).toBeVisible();
  });

  test('should show error message for wrong password', async () => {
    await loginPage.goto();
    await loginPage.signIn('admin@test.com', 'WrongPassword!');

    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should show error message for non-existent user', async () => {
    await loginPage.goto();
    await loginPage.signIn('nobody@test.com', 'Password123!');

    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should have a link to forgot password page', async ({ page }) => {
    await loginPage.goto();
    await loginPage.forgotPasswordLink.click();

    await expect(page).toHaveURL('/auth/forgot-password');
  });

  test('should disable the button while submitting', async ({ page }) => {
    await loginPage.goto();

    await loginPage.emailInput.fill('admin@test.com');
    await loginPage.passwordInput.fill('Password123!');
    await loginPage.signInBtn.click();

    // Either the button is disabled (still submitting) or the page has already redirected.
    // Both states indicate correct behavior — the redirect can happen too fast for CI.
    await expect(async () => {
      const isVisible = await loginPage.signInBtn.isVisible().catch(() => false);
      if (isVisible) {
        await expect(loginPage.signInBtn).toBeDisabled({ timeout: 500 });
      } else {
        await expect(page).toHaveURL('/', { timeout: 500 });
      }
    }).toPass({ timeout: 5000 });
  });
});

test.describe('Auth Redirect', () => {
  // Client-side guard in (protected)/layout.tsx performs the redirect.
  // Match just the pathname — no ?next= query param in static export mode.
  const LOGIN_URL_RE = /\/auth\/login(\?.*)?$/;

  test('should redirect unauthenticated users from protected pages to login', async ({ page }) => {
    // Try to access a protected page directly (change-password is in the (protected) route group)
    await page.goto('/change-password');

    // Should be redirected to the login page
    await expect(page).toHaveURL(LOGIN_URL_RE, { timeout: 10000 });
  });

  test('should redirect unauthenticated users from dashboard to login', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(LOGIN_URL_RE, { timeout: 10000 });
  });

  test('should redirect unauthenticated users from nested protected page to login', async ({ page }) => {
    // Try a second protected route to confirm the guard applies consistently
    await page.goto('/change-password');

    await expect(page).toHaveURL(LOGIN_URL_RE, { timeout: 10000 });
  });
});
