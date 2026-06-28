'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@old-st/ui';
import { useCategories } from '@old-st/client-common';
import { CreateCategoryForm } from '@/components/categories/create-category-form';
import { CategoriesTable } from '@/components/categories/categories-table';

export default function CategoriesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, isError, error } = useCategories();

  return (
    <>
      <Header title="Product Categories" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Manage product categories used to organize your catalog.
          </p>
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close' : '+ New Category'}
          </Button>
        </div>

        {showCreate && (
          <CreateCategoryForm onClose={() => setShowCreate(false)} />
        )}

        {isLoading && (
          <p className="text-muted-foreground">Loading categories...</p>
        )}
        {isError && <p className="text-destructive">{error.message}</p>}

        {data && <CategoriesTable categories={data.data} />}
      </div>
    </>
  );
}
