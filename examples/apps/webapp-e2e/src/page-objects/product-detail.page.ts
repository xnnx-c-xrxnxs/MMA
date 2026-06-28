import { type Page, type Locator } from '@playwright/test';

export class ProductDetailPage {
  readonly statusBadge: Locator;

  constructor(private page: Page) {
    this.statusBadge = page.getByTestId('product-status-badge');
  }

  async goto(productId: string) {
    await this.page.goto(`/products/${productId}`);
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

  async discontinue() {
    await this.actionButton('Discontinue').click();
  }

  async deleteProduct() {
    await this.actionButton('Delete').click();
  }
}
