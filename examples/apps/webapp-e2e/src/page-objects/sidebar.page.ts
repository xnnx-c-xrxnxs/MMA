import { type Page, type Locator } from '@playwright/test';

export class SidebarPage {
  private readonly nav: Locator;

  constructor(private page: Page) {
    this.nav = page.getByTestId('sidebar');
  }

  link(label: string): Locator {
    return this.nav.getByTestId(`sidebar-link-${label.toLowerCase()}`);
  }

  async navigateTo(label: string) {
    await this.link(label).click();
  }

  async navigateToDashboard() {
    await this.navigateTo('Dashboard');
  }

  async navigateToUsers() {
    await this.navigateTo('Users');
  }

  async navigateToProducts() {
    await this.navigateTo('Products');
  }

  async navigateToCategories() {
    await this.navigateTo('Categories');
  }

  async navigateToOrders() {
    await this.navigateTo('Orders');
  }
}
