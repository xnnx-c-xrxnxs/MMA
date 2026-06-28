/**
 * Shared E2E Test Data Factories
 *
 * Generates valid test data with deterministic, predictable values.
 * Uses a counter to ensure unique emails/names across test suites.
 */

let counter = 0;

function nextId(): number {
  return ++counter;
}

/** Reset the counter between test suites if needed. */
export function resetCounter(): void {
  counter = 0;
}

// ─── User factories ──────────────────────────────────────────────────────────

export function buildCreateUserInput(overrides: Partial<{
  email: string;
  firstName: string;
  lastName: string;
  userRole: 'USER' | 'ADMIN';
}> = {}) {
  const id = nextId();
  return {
    email: overrides.email ?? `e2e-user-${id}@test.example.com`,
    firstName: overrides.firstName ?? `E2EFirst${id}`,
    lastName: overrides.lastName ?? `E2ELast${id}`,
    userRole: overrides.userRole ?? ('USER' as const),
  };
}

export function buildCreateAdminInput(overrides: Partial<{
  email: string;
  firstName: string;
  lastName: string;
}> = {}) {
  return buildCreateUserInput({ ...overrides, userRole: 'ADMIN' });
}

// ─── Category factories ──────────────────────────────────────────────────────

export function buildCreateCategoryInput(overrides: Partial<{
  name: string;
  description: string;
}> = {}) {
  const id = nextId();
  return {
    name: overrides.name ?? `E2E Category ${id}`,
    description: overrides.description ?? `E2E category description ${id}`,
  };
}

// ─── Product factories ───────────────────────────────────────────────────────

export function buildCreateProductInput(
  categoryId: string,
  overrides: Partial<{
    name: string;
    description: string;
    price: number;
    inventory: number;
  }> = {},
) {
  const id = nextId();
  return {
    name: overrides.name ?? `E2E Product ${id}`,
    description: overrides.description ?? `E2E product description ${id}`,
    categoryId,
    price: overrides.price ?? 29.99,
    inventory: overrides.inventory ?? 100,
  };
}

// ─── Order factories ─────────────────────────────────────────────────────────

export function buildCreateOrderInput(
  customerId: string,
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>,
) {
  return {
    customerId,
    items,
  };
}

export function buildOrderItem(
  productId: string,
  overrides: Partial<{
    productName: string;
    quantity: number;
    price: number;
  }> = {},
) {
  const id = nextId();
  return {
    productId,
    productName: overrides.productName ?? `E2E Product ${id}`,
    quantity: overrides.quantity ?? 2,
    price: overrides.price ?? 29.99,
  };
}
