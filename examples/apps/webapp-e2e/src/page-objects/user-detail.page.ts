import { type Page, type Locator } from '@playwright/test';

export class UserDetailPage {
  readonly statusBadge: Locator;
  readonly editProfileBtn: Locator;

  constructor(private page: Page) {
    this.statusBadge = page.getByTestId('user-status-badge');
    this.editProfileBtn = page.getByTestId('edit-profile-btn');
  }

  async goto(userId: string) {
    await this.page.goto(`/users/${userId}`);
  }

  actionButton(label: string): Locator {
    return this.page.getByRole('button', { name: label });
  }

  async activate() {
    await this.actionButton('Activate').click();
  }

  async deactivate() {
    await this.actionButton('Deactivate').click();
  }

  async verifyEmail() {
    await this.actionButton('Verify Email').click();
  }

  async deleteUser() {
    await this.actionButton('Delete').click();
  }

  fieldValue(label: string): Locator {
    return this.page
      .locator('.flex.justify-between')
      .filter({ hasText: label })
      .locator('span:last-child');
  }
}
