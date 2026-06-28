import { type Page, type Locator } from '@playwright/test';

/**
 * Generic create form page object — works for user, product, and order create forms.
 */
export class CreateFormPage {
  constructor(private page: Page) {}

  form(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  async fillInput(placeholder: string, value: string) {
    await this.page.getByPlaceholder(placeholder).fill(value);
  }

  async selectOption(locator: Locator, value: string) {
    await locator.selectOption(value);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Create' }).click();
  }

  async cancel() {
    await this.page.getByRole('button', { name: 'Cancel' }).click();
  }
}
