'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button, Select } from '@old-st/ui';
import { useProductsByStatus, useCategories } from '@old-st/client-common';
import { PRODUCT_STATUSES } from '@old-st/contracts/product';
import { CreateProductForm } from '@/components/products/create-product-form';
import { ProductsTable } from '@/components/products/products-table';

export default function ProductsPage() {
  const [status, setStatus] = useState<string>('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, error } = useProductsByStatus({ status });
  const { data: categoriesData } = useCategories();

  return (
    <>
      <Header title="Products" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span id="products-status-filter-label" className="text-sm font-medium">Status:</span>
            <Select
              data-testid="status-filter"
              aria-labelledby="products-status-filter-label"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <Button data-testid="create-product-btn" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close' : '+ New Product'}
          </Button>
        </div>

        {showCreate && categoriesData && (
          <CreateProductForm
            categories={categoriesData.data}
            onClose={() => setShowCreate(false)}
          />
        )}

        {isLoading && <p className="text-muted-foreground">Loading products...</p>}
        {isError && <p className="text-destructive">{error.message}</p>}

        {data && <ProductsTable products={data.data} />}
      </div>
    </>
  );
}
