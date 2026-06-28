import { type Page, type Locator } from '@playwright/test';

export class OrderDetailPage {
  readonly statusBadge: Locator;

  constructor(private page: Page) {
    this.statusBadge = page.getByTestId('order-status-badge');
  }

  async goto(orderId: string) {
    await this.page.goto(`/orders/${orderId}`);
  }

  actionButton(label: string): Locator {
    return this.page.getByRole('button', { name: label });
  }

  async cancel() {
    await this.actionButton('Cancel').click();
  }

  async deleteOrder() {
    await this.actionButton('Delete').click();
  }
}
