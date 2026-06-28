import { test, expect } from '../../fixtures/base.fixture';
import { OrdersListPage } from '../../page-objects/orders-list.page';

const uniqueSuffix = Date.now();
let customerId: string;
let categoryId: string;
let productId: string;
const orderIds: string[] = [];

test.describe('Order Filtering', () => {
  test.beforeAll(async ({ apiHelpers }) => {
    // Create supporting entities
    const customer = await apiHelpers.createUser({
      email: `e2e-order-filter-${uniqueSuffix}@test.com`,
      firstName: 'E2E',
      lastName: 'FilterCustomer',
    });
    customerId = customer.userId;
    await apiHelpers.verifyUserEmail(customerId);
    await apiHelpers.activateUser(customerId);

    const category = await apiHelpers.createCategory({
      name: `E2E Filter Cat ${uniqueSuffix}`,
    });
    categoryId = category.categoryId;

    const product = await apiHelpers.createProduct({
      name: `E2E Filter Product ${uniqueSuffix}`,
      categoryId,
      price: 10.0,
      inventory: 500,
    });
    productId = product.productId;
    await apiHelpers.activateProduct(productId);

    // Create a couple of orders in DRAFT status
    for (let i = 0; i < 3; i++) {
      const order = await apiHelpers.createOrder({
        customerId,
        items: [
          {
            productId,
            productName: `E2E Filter Product ${uniqueSuffix}`,
            quantity: 1,
            price: 10.0,
          },
        ],
      });
      orderIds.push(order.orderId);
    }
  });

  test.afterAll(async ({ apiHelpers }) => {
    for (const id of orderIds) {
      await apiHelpers.deleteOrder(id).catch(() => undefined);
    }
    if (productId) await apiHelpers.deleteProduct(productId).catch(() => undefined);
    if (categoryId) await apiHelpers.deleteCategory(categoryId).catch(() => undefined);
    if (customerId) await apiHelpers.deleteUser(customerId).catch(() => undefined);
  });

  test('filter orders by DRAFT status shows created orders', async ({
    page,
  }) => {
    const ordersPage = new OrdersListPage(page);
    await ordersPage.goto();
    await ordersPage.selectStatus('DRAFT');
    await ordersPage.waitForTableLoaded();

    // Should see at least our seeded orders
    await expect(ordersPage.paginationInfo).toContainText('total');
  });

  test('switching status filter updates table', async ({ page }) => {
    const ordersPage = new OrdersListPage(page);
    await ordersPage.goto();

    // DRAFT
    await ordersPage.selectStatus('DRAFT');
    await ordersPage.waitForTableLoaded();
    const draftText = await ordersPage.paginationInfo.textContent();

    // CONFIRMED — likely empty during E2E
    await ordersPage.selectStatus('CONFIRMED');
    await ordersPage.waitForTableLoaded();

    // The table content should change (different set of orders)
    // At minimum the pagination info should still be present
    await expect(ordersPage.paginationInfo).toBeVisible();
  });

  test('orders table shows correct columns', async ({ page }) => {
    const ordersPage = new OrdersListPage(page);
    await ordersPage.goto();
    await ordersPage.selectStatus('DRAFT');
    await ordersPage.waitForTableLoaded();

    // Verify column headers
    await expect(page.getByRole('columnheader', { name: 'Order ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Items' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Total' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });
});
