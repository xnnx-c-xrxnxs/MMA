import { type Page, type Locator } from '@playwright/test';

/**
 * Page object for the /auth/login page.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInBtn: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signInForm: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email Address');
    this.passwordInput = page.getByLabel('Password');
    this.signInBtn = page.getByTestId('sign-in-btn');
    this.errorMessage = page.getByTestId('sign-in-error');
    this.forgotPasswordLink = page.getByTestId('forgot-password-link');
    this.signInForm = page.getByTestId('sign-in-form');
  }

  async goto() {
    await this.page.goto('/auth/login');
  }

  async signIn(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInBtn.click();
  }
}
