import { test, expect } from '../../fixtures/base.fixture';
import { ProductsListPage } from '../../page-objects/products-list.page';

const uniqueSuffix = Date.now();
let categoryId: string;
let testProductId: string;

test.describe('Product CRUD', () => {
  test.beforeAll(async ({ apiHelpers }) => {
    // Create a category for products
    const category = await apiHelpers.createCategory({
      name: `E2E Category ${uniqueSuffix}`,
    });
    categoryId = category.categoryId;
  });

  test.afterAll(async ({ apiHelpers }) => {
    if (testProductId) {
      await apiHelpers.deleteProduct(testProductId).catch(() => undefined);
    }
    if (categoryId) {
      await apiHelpers.deleteCategory(categoryId).catch(() => undefined);
    }
  });

  test('create a product via the form and see it in the table', async ({
    page,
    apiHelpers,
  }) => {
    const productsPage = new ProductsListPage(page);
    await productsPage.goto();

    // Products default to ACTIVE status page — newly created products start as ACTIVE
    await productsPage.waitForTableLoaded();

    // Open create form
    await productsPage.openCreateForm();
    await expect(page.getByTestId('create-product-form')).toBeVisible();

    // Fill the form
    const productName = `E2E Product ${uniqueSuffix}`;
    await page.getByPlaceholder('Product name').fill(productName);
    await page.getByPlaceholder('Price').fill('29.99');
    await page.getByPlaceholder('Inventory').fill('100');

    // Submit
    await page.getByRole('button', { name: 'Create' }).click();

    // Form should close and product should appear
    await expect(page.getByTestId('create-product-form')).toBeHidden({
      timeout: 10000,
    });
    await expect(productsPage.table.getByText(productName)).toBeVisible({ timeout: 15000 });

    // Extract productId for cleanup
    const link = productsPage.table.getByText(productName);
    const href = await link.getAttribute('href');
    if (href) {
      testProductId = href.replace('/products/', '');
    }
  });

  test('navigate to product detail and see status', async ({
    page,
    apiHelpers,
  }) => {
    // Seed a product via API
    const product = await apiHelpers.createProduct({
      name: `E2E Detail ${uniqueSuffix}`,
      categoryId,
      price: 19.99,
      inventory: 50,
    });
    testProductId = product.productId;

    const productsPage = new ProductsListPage(page);
    await productsPage.goto();
    // Products start as ACTIVE — default filter is ACTIVE
    await productsPage.waitForTableLoaded();

    // Click product name (scoped to table to avoid ambiguity)
    await productsPage.table.getByText(`E2E Detail ${uniqueSuffix}`).click();
    await expect(page).toHaveURL(`/products/${product.productId}`);
    await expect(page.getByTestId('product-status-badge')).toHaveText('Active');
  });

  test('filter products by status', async ({ page }) => {
    const productsPage = new ProductsListPage(page);
    await productsPage.goto();

    // Default is ACTIVE
    await expect(productsPage.statusFilter).toHaveValue('ACTIVE');

    // Switch to INACTIVE
    await productsPage.selectStatus('INACTIVE');
    await productsPage.waitForTableLoaded();
    await expect(productsPage.statusFilter).toHaveValue('INACTIVE');
  });
});
