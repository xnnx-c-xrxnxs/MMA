'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Badge, Button, Input, Card, CardContent, CardHeader, CardTitle } from '@old-st/ui';
import {
  useCategory,
  useUpdateCategory,
  useDeleteCategory,
  formatCategoryStatus,
} from '@old-st/client-common';
import type { UpdateCategoryInput } from '@old-st/contracts/product';
import { CategoryStatusEnum } from '@old-st/contracts/product';
import { categoryStatusVariant } from '@/lib/status-variants';

export default function CategoryDetailPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = use(params);
  const router = useRouter();
  const { data: category, isLoading, isError, error } = useCategory(categoryId);
  const updateCategory = useUpdateCategory(categoryId);
  const deleteCategory = useDeleteCategory();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateCategoryInput>({
    name: '',
    description: '',
  });

  const startEditing = () => {
    if (category) {
      setForm({ name: category.name, description: category.description ?? '' });
      setEditing(true);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateCategory.mutate(form, { onSuccess: () => setEditing(false) });
  };

  const handleDelete = () => {
    deleteCategory.mutate(categoryId, {
      onSuccess: () => router.push('/products/categories'),
    });
  };

  if (isLoading) {
    return (
      <>
        <Header title="Category Detail" />
        <div className="p-6">
          <p className="text-muted-foreground">Loading category...</p>
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Header title="Category Detail" />
        <div className="p-6">
          <p className="text-destructive">{error.message}</p>
        </div>
      </>
    );
  }

  if (!category) return null;

  return (
    <>
      <Header title={category.name} />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={categoryStatusVariant(category.status)}>
            {formatCategoryStatus(category.status)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Created {new Date(category.dateCreated).toLocaleDateString()}
          </span>
        </div>

        {editing ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit Category</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdate} className="grid gap-3">
                <Input
                  placeholder="Category name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="Description (optional)"
                  value={form.description ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateCategory.isPending}>
                    {updateCategory.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
                {updateCategory.isError && (
                  <p className="text-sm text-destructive">
                    {updateCategory.error.message}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Name
                </p>
                <p>{category.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Description
                </p>
                <p>{category.description || '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </p>
                <p>{new Date(category.updatedAt).toLocaleString()}</p>
              </div>
              <div className="flex gap-2 pt-2">
                {category.status !== CategoryStatusEnum.DELETED && (
                  <>
                    <Button onClick={startEditing}>Edit</Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleteCategory.isPending}
                    >
                      {deleteCategory.isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => router.push('/products/categories')}
                >
                  Back to Categories
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
