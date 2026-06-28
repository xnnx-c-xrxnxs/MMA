import { signIn, getAccessToken } from '@old-st/e2e-helpers';

const baseUrl = `http://${process.env.HOST ?? 'localhost'}:${process.env.PRODUCT_SERVICE_PORT ?? '3001'}/api`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}

describe('Product API E2E — CRUD & Status Transitions', () => {
  const createdCategoryIds: string[] = [];
  const createdProductIds: string[] = [];

  beforeAll(async () => {
    await signIn();
  });

  async function createTestCategory(suffix: string) {
    const res = await api('POST', '/categories', {
      name: `E2E Category ${suffix} ${Date.now()}`,
      description: 'E2E test category',
    });
    expect(res.status).toBe(201);
    createdCategoryIds.push(res.data.categoryId);
    return res.data;
  }

  async function createTestProduct(categoryId: string, suffix: string) {
    const res = await api('POST', '/products', {
      name: `E2E Product ${suffix} ${Date.now()}`,
      description: 'E2E test product',
      categoryId,
      price: 29.99,
      inventory: 100,
    });
    expect(res.status).toBe(201);
    createdProductIds.push(res.data.productId);
    return res.data;
  }

  afterAll(async () => {
    for (const id of createdProductIds) {
      try {
        await api('DELETE', `/products/${id}`);
      } catch {
        // Ignore
      }
    }
    for (const id of createdCategoryIds) {
      try {
        await api('DELETE', `/categories/${id}`);
      } catch {
        // Ignore
      }
    }
  });

  // ── Category CRUD ──────────────────────────────────────────────────────────

  describe('Categories', () => {
    it('POST /categories — should create a category', async () => {
      const cat = await createTestCategory('create');
      expect(cat.name).toContain('E2E Category create');
      expect(cat.status).toBe('ACTIVE');
    });

    it('GET /categories/:id — should return a category', async () => {
      const cat = await createTestCategory('get');
      const res = await api('GET', `/categories/${cat.categoryId}`);
      expect(res.status).toBe(200);
      expect(res.data.categoryId).toBe(cat.categoryId);
    });

    it('GET /categories — should list categories', async () => {
      await createTestCategory('list');
      const res = await api('GET', '/categories?limit=10');
      expect(res.status).toBe(200);
      expect(res.data.data).toBeDefined();
    });

    it('PATCH /categories/:id — should update a category', async () => {
      const cat = await createTestCategory('update');
      const res = await api('PATCH', `/categories/${cat.categoryId}`, {
        name: 'Updated Category Name',
      });
      expect(res.status).toBe(200);
      expect(res.data.name).toBe('Updated Category Name');
    });

    it('DELETE /categories/:id — should delete a category', async () => {
      const cat = await createTestCategory('delete');
      const delRes = await api('DELETE', `/categories/${cat.categoryId}`);
      expect([200, 204]).toContain(delRes.status);
    });
  });

  // ── Product CRUD ───────────────────────────────────────────────────────────

  describe('Products', () => {
    let sharedCategoryId: string;

    beforeAll(async () => {
      const cat = await createTestCategory('products-parent');
      sharedCategoryId = cat.categoryId;
    });

    it('POST /products — should create a product', async () => {
      const product = await createTestProduct(sharedCategoryId, 'create');
      expect(product.name).toContain('E2E Product create');
      expect(product.status).toBe('ACTIVE');
      expect(product.price).toBe(29.99);
    });

    it('GET /products/:id — should return a product', async () => {
      const product = await createTestProduct(sharedCategoryId, 'get');
      const res = await api('GET', `/products/${product.productId}`);
      expect(res.status).toBe(200);
      expect(res.data.productId).toBe(product.productId);
    });

    it('PATCH /products/:id/details — should update product details', async () => {
      const product = await createTestProduct(sharedCategoryId, 'update-details');
      const res = await api('PATCH', `/products/${product.productId}/details`, {
        name: 'Updated Product Name',
      });
      expect(res.status).toBe(200);
      expect(res.data.name).toBe('Updated Product Name');
    });

    it('PATCH /products/:id/price — should update product price', async () => {
      const product = await createTestProduct(sharedCategoryId, 'update-price');
      const res = await api('PATCH', `/products/${product.productId}/price`, {
        price: 49.99,
      });
      expect(res.status).toBe(200);
      expect(res.data.price).toBe(49.99);
    });

    it('PATCH /products/:id/inventory — should update inventory', async () => {
      const product = await createTestProduct(sharedCategoryId, 'update-inv');
      const res = await api('PATCH', `/products/${product.productId}/inventory`, {
        inventory: 200,
      });
      expect(res.status).toBe(200);
      expect(res.data.inventory).toBe(200);
    });

    it('DELETE /products/:id — should delete a product', async () => {
      const product = await createTestProduct(sharedCategoryId, 'delete');
      const delRes = await api('DELETE', `/products/${product.productId}`);
      expect([200, 204]).toContain(delRes.status);
    });
  });

  // ── Product Status Transitions ─────────────────────────────────────────────

  describe('Product Status Transitions', () => {
    let catId: string;

    beforeAll(async () => {
      const cat = await createTestCategory('status-parent');
      catId = cat.categoryId;
    });

    it('should deactivate an ACTIVE product', async () => {
      const product = await createTestProduct(catId, 'deactivate');
      expect(product.status).toBe('ACTIVE');

      const res = await api('POST', `/products/${product.productId}/deactivate`);
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('INACTIVE');
    });

    it('should activate an INACTIVE product', async () => {
      const product = await createTestProduct(catId, 'activate');
      await api('POST', `/products/${product.productId}/deactivate`);

      const res = await api('POST', `/products/${product.productId}/activate`);
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ACTIVE');
    });

    it('should discontinue an ACTIVE product', async () => {
      const product = await createTestProduct(catId, 'discontinue');

      const res = await api('POST', `/products/${product.productId}/discontinue`);
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('DISCONTINUED');
    });
  });

  // ── Product Filtering ──────────────────────────────────────────────────────

  describe('Product Filtering', () => {
    let catId: string;
    let filterProductIds: string[];

    beforeAll(async () => {
      const cat = await createTestCategory('filter-parent');
      catId = cat.categoryId;
      const p1 = await createTestProduct(catId, 'filter1');
      const p2 = await createTestProduct(catId, 'filter2');
      filterProductIds = [p1.productId, p2.productId];
    });

    it('GET /products/by-status — should list by status', async () => {
      const res = await api('GET', '/products/by-status?status=ACTIVE&limit=10');
      expect(res.status).toBe(200);
      expect(res.data.data).toBeDefined();
      // Only assert on products we created — other tests may change status on their products
      // leaving stale GSI entries due to DynamoDB eventual consistency.
      const ours = res.data.data.filter((p: { productId: string }) =>
        filterProductIds.includes(p.productId)
      );
      expect(ours.length).toBeGreaterThanOrEqual(1);
      for (const p of ours) {
        expect(p.status).toBe('ACTIVE');
      }
    });

    it('GET /products/by-category — should list by category', async () => {
      const res = await api('GET', `/products/by-category?categoryId=${catId}&limit=10`);
      expect(res.status).toBe(200);
      expect(res.data.data).toBeDefined();
      for (const p of res.data.data) {
        expect(p.categoryId).toBe(catId);
      }
    });

    it('GET /products/search — should search by name', async () => {
      const res = await api('GET', `/products/search?searchTerm=${encodeURIComponent('E2E Product')}&limit=10`);
      expect(res.status).toBe(200);
      expect(res.data.data).toBeDefined();
    });
  });
});
