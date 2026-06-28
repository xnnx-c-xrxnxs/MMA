import { type Page, type Locator } from '@playwright/test';

export class UsersListPage {
  readonly table: Locator;
  readonly statusFilter: Locator;
  readonly createBtn: Locator;
  readonly loadingText: Locator;

  constructor(private page: Page) {
    this.table = page.getByTestId('users-table');
    this.statusFilter = page.getByTestId('status-filter');
    this.createBtn = page.getByTestId('create-user-btn');
    this.loadingText = page.getByText('Loading users...');
  }

  async goto() {
    await this.page.goto('/users');
  }

  async selectStatus(status: string) {
    await this.statusFilter.selectOption(status);
  }

  async openCreateForm() {
    await this.createBtn.click();
  }

  userRow(userId: string): Locator {
    return this.page.getByTestId(`user-row-${userId}`);
  }

  async getUserRowByName(name: string): Promise<Locator> {
    return this.table.getByRole('row').filter({ hasText: name });
  }

  async waitForTableLoaded() {
    await this.loadingText.waitFor({ state: 'hidden', timeout: 10000 });
  }
}
