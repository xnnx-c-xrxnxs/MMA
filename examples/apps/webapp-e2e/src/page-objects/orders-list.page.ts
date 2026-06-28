import { type Page, type Locator } from '@playwright/test';

export class OrdersListPage {
  readonly table: Locator;
  readonly statusFilter: Locator;
  readonly createBtn: Locator;
  readonly loadingText: Locator;
  readonly paginationInfo: Locator;

  constructor(private page: Page) {
    this.table = page.getByTestId('orders-table');
    this.statusFilter = page.getByTestId('status-filter');
    this.createBtn = page.getByTestId('create-order-btn');
    this.loadingText = page.getByText('Loading orders...');
    this.paginationInfo = page.getByTestId('pagination-info');
  }

  async goto() {
    await this.page.goto('/orders');
  }

  async selectStatus(status: string) {
    await this.statusFilter.selectOption(status);
  }

  async openCreateForm() {
    await this.createBtn.click();
  }

  orderRow(orderId: string): Locator {
    return this.page.getByTestId(`order-row-${orderId}`);
  }

  async waitForTableLoaded() {
    await this.loadingText.waitFor({ state: 'hidden', timeout: 10000 });
  }
}
