import { test, expect } from '../../fixtures/base.fixture';
import { UserDetailPage } from '../../page-objects/user-detail.page';

const uniqueSuffix = Date.now();
let testUserId: string;

test.describe('User Actions (detail page)', () => {
  test.beforeEach(async ({ apiHelpers }) => {
    // Create a fresh user for each test
    const user = await apiHelpers.createUser({
      email: `e2e-actions-${uniqueSuffix}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      firstName: 'E2E',
      lastName: 'Actions',
    });
    testUserId = user.userId;
  });

  test.afterEach(async ({ apiHelpers }) => {
    if (testUserId) {
      await apiHelpers.deleteUser(testUserId).catch(() => undefined);
    }
  });

  test('verify email from detail page', async ({ page }) => {
    const detail = new UserDetailPage(page);
    await detail.goto(testUserId);

    await expect(detail.statusBadge).toHaveText('Pending');
    await expect(detail.actionButton('Verify Email')).toBeVisible();

    // Click verify and wait for the API response to complete
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('verify-email') && resp.ok(),
    );
    await detail.verifyEmail();
    await responsePromise;

    // Status stays PENDING (verify-email only sets internal emailVerified flag)
    await expect(detail.statusBadge).toHaveText('Pending');
  });

  test('activate a user from detail page', async ({ page, apiHelpers }) => {
    // Verify email first (required for activation)
    await apiHelpers.verifyUserEmail(testUserId);

    const detail = new UserDetailPage(page);
    await detail.goto(testUserId);

    await expect(detail.statusBadge).toHaveText('Pending');

    await detail.activate();

    // Status should change to ACTIVE
    await expect(detail.statusBadge).toHaveText('Active', { timeout: 10000 });
    await expect(detail.actionButton('Deactivate')).toBeVisible();
  });

  test('deactivate an active user from detail page', async ({
    page,
    apiHelpers,
  }) => {
    // Verify email + activate via API (activation requires verified email)
    await apiHelpers.verifyUserEmail(testUserId);
    await apiHelpers.activateUser(testUserId);

    const detail = new UserDetailPage(page);
    await detail.goto(testUserId);

    await expect(detail.statusBadge).toHaveText('Active');

    await detail.deactivate();

    await expect(detail.statusBadge).toHaveText('Inactive', { timeout: 10000 });
    await expect(detail.actionButton('Activate')).toBeVisible();
  });

  test('delete a user from detail page', async ({ page, apiHelpers }) => {
    const detail = new UserDetailPage(page);
    await detail.goto(testUserId);

    await detail.deleteUser();

    // Status should change to DELETED, no more action buttons
    await expect(detail.statusBadge).toHaveText('Deleted', { timeout: 10000 });
    testUserId = ''; // Already deleted
  });
});
