import { test, expect } from '../../fixtures/base.fixture';
import { UsersListPage } from '../../page-objects/users-list.page';
import { UserDetailPage } from '../../page-objects/user-detail.page';

let testUserId: string;
const uniqueSuffix = Date.now();

test.describe('User CRUD', () => {
  test.afterAll(async ({ apiHelpers }) => {
    if (testUserId) {
      await apiHelpers.deleteUser(testUserId).catch(() => undefined);
    }
  });

  test('create a user via the form and see it in the table', async ({
    page,
    apiHelpers,
  }) => {
    const usersPage = new UsersListPage(page);
    await usersPage.goto();

    // Switch to PENDING to see newly created users
    await usersPage.selectStatus('PENDING');
    await usersPage.waitForTableLoaded();

    // Open create form
    await usersPage.openCreateForm();
    await expect(page.getByTestId('create-user-form')).toBeVisible();

    // Fill the form
    const email = `e2e-create-${uniqueSuffix}@test.com`;
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('First name').fill('E2E');
    await page.getByPlaceholder('Last name').fill('CreateTest');

    // Submit
    await page.getByRole('button', { name: 'Create' }).click();

    // Form should close and user should appear in the table
    await expect(page.getByTestId('create-user-form')).toBeHidden({ timeout: 10000 });
    await expect(usersPage.table.getByText('E2E CreateTest').first()).toBeVisible({ timeout: 10000 });

    // Extract userId from the row link for cleanup
    const link = usersPage.table.getByText('E2E CreateTest').first();
    const href = await link.getAttribute('href');
    if (href) {
      testUserId = href.replace('/users/', '');
    }
  });

  test('navigate to user detail page', async ({ page, apiHelpers }) => {
    // Seed a user via API
    const user = await apiHelpers.createUser({
      email: `e2e-detail-${uniqueSuffix}@test.com`,
      firstName: 'E2E',
      lastName: 'DetailTest',
    });
    testUserId = user.userId;

    const usersPage = new UsersListPage(page);
    await usersPage.goto();
    await usersPage.selectStatus('PENDING');
    await usersPage.waitForTableLoaded();

    // Click on user name
    await page.getByText('E2E DetailTest').click();

    // Should be on detail page
    await expect(page).toHaveURL(`/users/${user.userId}`);
    const detailPage = new UserDetailPage(page);
    await expect(detailPage.statusBadge).toHaveText('Pending');
    await expect(page.getByText(user.email)).toBeVisible();
  });

  test('filter users by status', async ({ page, apiHelpers }) => {
    const usersPage = new UsersListPage(page);
    await usersPage.goto();

    // Default is ACTIVE — table should not show PENDING users
    await usersPage.waitForTableLoaded();

    // Switch to PENDING
    await usersPage.selectStatus('PENDING');
    await usersPage.waitForTableLoaded();

    // The status filter should have value PENDING
    await expect(usersPage.statusFilter).toHaveValue('PENDING');
  });
});
