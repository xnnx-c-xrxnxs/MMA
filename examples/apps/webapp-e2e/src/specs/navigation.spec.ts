import { test, expect } from '../fixtures/base.fixture';
import { SidebarPage } from '../page-objects/sidebar.page';

test.describe('Navigation', () => {
  test('dashboard page shows welcome message and section cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome to Old ST Admin' })).toBeVisible();
    await expect(page.getByTestId('dashboard-card-users')).toBeVisible();
    await expect(page.getByTestId('dashboard-card-products')).toBeVisible();
    await expect(page.getByTestId('dashboard-card-orders')).toBeVisible();
  });

  test('sidebar navigates to users page', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    await page.goto('/');

    await sidebar.navigateToUsers();
    await expect(page).toHaveURL('/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });

  test('sidebar navigates to products page', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    await page.goto('/');

    await sidebar.navigateToProducts();
    await expect(page).toHaveURL('/products');
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  });

  test('sidebar navigates to categories page', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    await page.goto('/');

    await sidebar.navigateToCategories();
    await expect(page).toHaveURL('/products/categories');
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
  });

  test('sidebar navigates to orders page', async ({ page }) => {
    const sidebar = new SidebarPage(page);
    await page.goto('/');

    await sidebar.navigateToOrders();
    await expect(page).toHaveURL('/orders');
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  });

  test('dashboard section cards navigate to correct pages', async ({ page }) => {
    await page.goto('/');

    // Click the Users card
    await page.getByTestId('dashboard-card-users').click();
    await expect(page).toHaveURL('/users');

    // Go back and click Products card
    await page.goto('/');
    await page.getByTestId('dashboard-card-products').click();
    await expect(page).toHaveURL('/products');

    // Go back and click Orders card
    await page.goto('/');
    await page.getByTestId('dashboard-card-orders').click();
    await expect(page).toHaveURL('/orders');
  });
});
