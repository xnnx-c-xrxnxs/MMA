import { type Page, type Locator } from '@playwright/test';

/**
 * Page object for the /auth/forgot-password page.
 */
export class ForgotPasswordPage {
  readonly page: Page;
  readonly container: Locator;
  readonly emailInput: Locator;
  readonly submitBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.getByTestId('forgot-password-form');
    this.emailInput = page.getByTestId('forgot-password-email');
    this.submitBtn = page.getByTestId('forgot-password-submit');
  }

  async goto() {
    await this.page.goto('/auth/forgot-password');
  }

  async requestResetCode(email: string) {
    await this.emailInput.fill(email);
    await this.submitBtn.click();
  }
}
