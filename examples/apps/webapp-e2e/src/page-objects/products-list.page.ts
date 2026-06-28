import { type Page, type Locator } from '@playwright/test';

export class ProductsListPage {
  readonly table: Locator;
  readonly statusFilter: Locator;
  readonly createBtn: Locator;
  readonly loadingText: Locator;

  constructor(private page: Page) {
    this.table = page.getByTestId('products-table');
    this.statusFilter = page.getByTestId('status-filter');
    this.createBtn = page.getByTestId('create-product-btn');
    this.loadingText = page.getByText('Loading products...');
  }

  async goto() {
    await this.page.goto('/products');
  }

  async selectStatus(status: string) {
    await this.statusFilter.selectOption(status);
  }

  async openCreateForm() {
    await this.createBtn.click();
  }

  productRow(productId: string): Locator {
    return this.page.getByTestId(`product-row-${productId}`);
  }

  async getProductRowByName(name: string): Promise<Locator> {
    return this.table.getByRole('row').filter({ hasText: name });
  }

  async waitForTableLoaded() {
    await this.loadingText.waitFor({ state: 'hidden', timeout: 10000 });
  }
}
