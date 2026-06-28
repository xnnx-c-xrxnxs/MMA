---
name: write-webapp-e2e-tests
description: Add Playwright E2E test specs for a domain in the webapp. Use this when creating page objects, test specs, or data-testid attributes for browser-based E2E testing. Covers the page object pattern, fixture-based test setup, data seeding via API, navigation testing, CRUD flows, and status-action testing.
---

# Writing Webapp E2E Tests (Playwright)

Canonical references:
- `apps/webapp-e2e/` — full Playwright project
- `apps/webapp-e2e/src/fixtures/base.fixture.ts` — extended test with API helpers
- `apps/webapp-e2e/src/page-objects/` — page object classes
- `apps/webapp-e2e/src/specs/` — test spec files
- `apps/webapp-e2e/src/utils/selectors.ts` — data-testid constants

Tests run with Playwright against the running Next.js webapp + all backend services.

---

## Project Structure

```
apps/webapp-e2e/
  playwright.config.ts            ← Playwright config (baseURL, chromium, traces)
  project.json                    ← Nx project (implicitDependencies: ["webapp"])
  tsconfig.json
  src/
    fixtures/
      base.fixture.ts             ← Extended test with ApiHelpers class
    page-objects/
      sidebar.page.ts             ← Sidebar navigation
      {domain}-list.page.ts       ← Domain list page (table, filters, create button)
      {domain}-detail.page.ts     ← Domain detail page (status badge, actions)
      create-form.page.ts         ← Generic create form helper
    specs/
      navigation.spec.ts          ← Cross-domain navigation tests
      {domain}/
        {domain}-crud.spec.ts     ← CRUD flow via UI
        {domain}-actions.spec.ts  ← Status transition actions
        {domain}-filtering.spec.ts ← Filter and pagination
    utils/
      selectors.ts                ← data-testid constant strings
```

---

## Step-by-Step: Add Tests for a New Domain

### 1. Add data-testid attributes to webapp components

Every interactive element that E2E tests target must have a `data-testid` attribute:

| Component | data-testid pattern |
|---|---|
| Domain table | `data-testid="{domain}s-table"` |
| Table row | `data-testid="{domain}-row-{id}"` |
| Status filter select | `data-testid="status-filter"` |
| Create button | `data-testid="create-{domain}-btn"` |
| Create form | `data-testid="create-{domain}-form"` |
| Status badge (detail) | `data-testid="{domain}-status-badge"` |
| Pagination info | `data-testid="pagination-info"` |

**Where to add:** In the component JSX, add `data-testid` as a prop. All `@mma/ui` components spread `...props`, so `data-testid` passes through automatically.

### 2. Add selectors to `utils/selectors.ts`

```typescript
export const NEW_DOMAIN_TABLE = '{domain}s-table';
export const NEW_DOMAIN_ROW = (id: string) => `{domain}-row-${id}`;
export const NEW_DOMAIN_STATUS_BADGE = '{domain}-status-badge';
export const CREATE_NEW_DOMAIN_BTN = 'create-{domain}-btn';
export const CREATE_NEW_DOMAIN_FORM = 'create-{domain}-form';
```

### 3. Create page objects

**List page object** (`{domain}-list.page.ts`):

```typescript
import { type Page, type Locator } from '@playwright/test';
import { NEW_DOMAIN_TABLE, STATUS_FILTER, CREATE_NEW_DOMAIN_BTN } from '../utils/selectors';

export class NewDomainListPage {
  readonly page: Page;
  readonly table: Locator;
  readonly statusFilter: Locator;
  readonly createBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.table = page.getByTestId(NEW_DOMAIN_TABLE);
    this.statusFilter = page.getByTestId(STATUS_FILTER);
    this.createBtn = page.getByTestId(CREATE_NEW_DOMAIN_BTN);
  }

  async goto() {
    await this.page.goto('/{domain}s');
  }

  async selectStatus(status: string) {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: status }).click();
  }

  entityRow(id: string) {
    return this.page.getByTestId(`{domain}-row-${id}`);
  }

  async waitForTableLoaded() {
    await this.table.waitFor({ state: 'visible' });
  }
}
```

**Detail page object** (`{domain}-detail.page.ts`):

```typescript
import { type Page, type Locator } from '@playwright/test';
import { NEW_DOMAIN_STATUS_BADGE } from '../utils/selectors';

export class NewDomainDetailPage {
  readonly page: Page;
  readonly statusBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statusBadge = page.getByTestId(NEW_DOMAIN_STATUS_BADGE);
  }

  async goto(entityId: string) {
    await this.page.goto(`/{domain}s/${entityId}`);
  }

  actionButton(label: string) {
    return this.page.getByRole('button', { name: label });
  }

  async performAction(label: string) {
    await this.actionButton(label).click();
  }

  fieldValue(label: string) {
    return this.page.locator(`text=${label}`).locator('..').locator('dd, span, p').first();
  }
}
```

### 4. Add API helper methods to fixture

If the `ApiHelpers` class in `base.fixture.ts` doesn't have methods for the new domain, add them:

```typescript
// In ApiHelpers class:
async createNewEntity(data: Record<string, unknown>) {
  const res = await this.newDomainRequest.post('/v1/{domain}s', { data });
  return res.json();
}

async deleteNewEntity(id: string) {
  await this.newDomainRequest.delete(`/v1/{domain}s/${id}`);
}
```

Also add a new `APIRequestContext` for the domain's API URL in the fixture setup:

```typescript
const newDomainRequest = await playwright.request.newContext({
  baseURL: process.env.API_NEW_DOMAIN_URL || 'http://localhost:{PORT}/api',
});
```

### 5. Write test specs

**CRUD spec** — Tests creating an entity via the UI form, viewing in the list, navigating to detail:

```typescript
import { test, expect } from '../../fixtures/base.fixture';
import { NewDomainListPage } from '../../page-objects/{domain}-list.page';
import { NewDomainDetailPage } from '../../page-objects/{domain}-detail.page';
import { CreateFormPage } from '../../page-objects/create-form.page';

test.describe('{Domain} CRUD', () => {
  let listPage: NewDomainListPage;
  let detailPage: NewDomainDetailPage;
  let createForm: CreateFormPage;

  test.beforeEach(async ({ page }) => {
    listPage = new NewDomainListPage(page);
    detailPage = new NewDomainDetailPage(page);
    createForm = new CreateFormPage(page);
  });

  test('should create a {domain} via form', async ({ page }) => {
    await listPage.goto();
    await listPage.createBtn.click();
    
    await createForm.fillInput('Name', 'Test Entity');
    // Fill other fields...
    await createForm.submit();
    
    // Verify redirect or list update
    await expect(listPage.table).toBeVisible();
  });

  test('should navigate to {domain} detail', async ({ page, apiHelpers }) => {
    // Seed via API
    const entity = await apiHelpers.createNewEntity({ name: 'Seeded' });
    
    await listPage.goto();
    await listPage.entityRow(entity.{domain}Id).click();
    
    await expect(detailPage.statusBadge).toBeVisible();
  });
});
```

**Actions spec** — Tests status transitions from the detail page:

```typescript
test.describe('{Domain} Actions', () => {
  let entityId: string;

  test.beforeEach(async ({ apiHelpers }) => {
    const entity = await apiHelpers.createNewEntity(testData);
    entityId = entity.{domain}Id;
  });

  test.afterEach(async ({ apiHelpers }) => {
    await apiHelpers.deleteNewEntity(entityId).catch(() => {});
  });

  test('should activate {domain}', async ({ page }) => {
    const detailPage = new NewDomainDetailPage(page);
    await detailPage.goto(entityId);
    
    await detailPage.performAction('Activate');
    await expect(detailPage.statusBadge).toHaveText(/ACTIVE/i);
  });
});
```

---

## Fixture Pattern

All specs import `test` and `expect` from `src/fixtures/base.fixture.ts`, NOT from `@playwright/test` directly. This provides:

- `apiHelpers` — For seeding/cleaning test data via backend APIs
- Properly scoped `APIRequestContext` instances for each domain

```typescript
import { test, expect } from '../fixtures/base.fixture';
```

---

## Data Seeding Strategy

- **Seed via API** (preferred): Use `apiHelpers` to create entities before each test. This is faster and more reliable than filling UI forms for setup.
- **UI form testing**: Only test form submission in the CRUD spec. All other specs seed data via API.
- **Cleanup in afterEach/afterAll**: Delete seeded entities. Use `.catch(() => {})` on cleanup to avoid test failures from cleanup errors.

---

## Locator Strategy

Priority order:
1. `page.getByTestId(...)` — Primary strategy for domain-specific elements
2. `page.getByRole(...)` — For generic interactive elements (buttons, links, options)
3. `page.getByText(...)` — For verifying visible content
4. `page.getByPlaceholder(...)` — For form inputs

**Never use CSS selectors or XPath.** Playwright's built-in locators auto-wait and are more resilient.

---

## Checklist

- [ ] Add `data-testid` attributes to all target components in `apps/webapp/src/components/{domain}/`
- [ ] Add `data-testid` to page-level controls in `apps/webapp/src/app/{domain}/page.tsx`
- [ ] Add `data-testid` to detail page badges in `apps/webapp/src/app/{domain}/[{entity}Id]/page.tsx`
- [ ] Add selector constants to `apps/webapp-e2e/src/utils/selectors.ts`
- [ ] Create list page object in `apps/webapp-e2e/src/page-objects/`
- [ ] Create detail page object in `apps/webapp-e2e/src/page-objects/`
- [ ] Add API helper methods to `apps/webapp-e2e/src/fixtures/base.fixture.ts` if needed
- [ ] Create CRUD spec in `apps/webapp-e2e/src/specs/{domain}/`
- [ ] Create actions spec (if domain has status transitions)
- [ ] Create filtering spec (if domain has filters/pagination)
- [ ] All specs import from `../fixtures/base.fixture` — never from `@playwright/test`
- [ ] All specs clean up seeded data in `afterEach`/`afterAll`
