import { test, expect } from '../../fixtures/base.fixture';
import { OrdersListPage } from '../../page-objects/orders-list.page';

const uniqueSuffix = Date.now();
let customerId: string;
let categoryId: string;
let productId: string;
let testOrderId: string;

test.describe('Order Lifecycle', () => {
  test.beforeAll(async ({ apiHelpers }) => {
    // Create supporting entities: customer + category + product
    const customer = await apiHelpers.createUser({
      email: `e2e-order-customer-${uniqueSuffix}@test.com`,
      firstName: 'E2E',
      lastName: 'Customer',
    });
    customerId = customer.userId;
    await apiHelpers.verifyUserEmail(customerId);
    await apiHelpers.activateUser(customerId);

    const category = await apiHelpers.createCategory({
      name: `E2E Order Cat ${uniqueSuffix}`,
    });
    categoryId = category.categoryId;

    const product = await apiHelpers.createProduct({
      name: `E2E Order Product ${uniqueSuffix}`,
      categoryId,
      price: 25.0,
      inventory: 200,
    });
    productId = product.productId;
    await apiHelpers.activateProduct(productId);
  });

  test.afterAll(async ({ apiHelpers }) => {
    if (testOrderId) await apiHelpers.deleteOrder(testOrderId).catch(() => undefined);
    if (productId) await apiHelpers.deleteProduct(productId).catch(() => undefined);
    if (categoryId) await apiHelpers.deleteCategory(categoryId).catch(() => undefined);
    if (customerId) await apiHelpers.deleteUser(customerId).catch(() => undefined);
  });

  test('view orders list with status filter', async ({ page }) => {
    const ordersPage = new OrdersListPage(page);
    await ordersPage.goto();

    // Default filter is DRAFT
    await expect(ordersPage.statusFilter).toHaveValue('DRAFT');
    await ordersPage.waitForTableLoaded();

    // Switch to PENDING
    await ordersPage.selectStatus('PENDING');
    await ordersPage.waitForTableLoaded();
    await expect(ordersPage.statusFilter).toHaveValue('PENDING');
  });

  test('view order detail page', async ({ page, apiHelpers }) => {
    // Seed an order via API
    const order = await apiHelpers.createOrder({
      customerId,
      items: [
        {
          productId,
          productName: `E2E Order Product ${uniqueSuffix}`,
          quantity: 2,
          price: 25.0,
        },
      ],
    });
    testOrderId = order.orderId;

    const ordersPage = new OrdersListPage(page);
    await ordersPage.goto();

    // Orders start in DRAFT
    await ordersPage.selectStatus('DRAFT');
    await ordersPage.waitForTableLoaded();

    // Find the order row by truncated ID and click the link
    const truncatedId = order.orderId.slice(0, 8) + '...';
    await page.getByText(truncatedId).click();

    await expect(page).toHaveURL(`/orders/${order.orderId}`);
    await expect(page.getByTestId('order-status-badge')).toHaveText('Draft');
    await expect(page.getByRole('cell', { name: '$50.00' })).toBeVisible();
  });

  test('pagination info shows total count', async ({ page, apiHelpers }) => {
    const ordersPage = new OrdersListPage(page);
    await ordersPage.goto();
    await ordersPage.selectStatus('DRAFT');
    await ordersPage.waitForTableLoaded();

    // Pagination info should be visible
    await expect(ordersPage.paginationInfo).toBeVisible();
    await expect(ordersPage.paginationInfo).toContainText('Page');
    await expect(ordersPage.paginationInfo).toContainText('total');
  });
});
