'use client';

import { useState } from 'react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@old-st/ui';
import { useCreateCategory } from '@old-st/client-common';
import type { CreateCategoryInput } from '@old-st/contracts/product';

export function CreateCategoryForm({ onClose }: { onClose: () => void }) {
  const createCategory = useCreateCategory();
  const [form, setForm] = useState<CreateCategoryInput>({
    name: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCategory.mutate(form, { onSuccess: () => onClose() });
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Create Category</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Category name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            placeholder="Description (optional)"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? 'Creating...' : 'Create'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
          {createCategory.isError && (
            <p className="text-sm text-destructive sm:col-span-2">
              {createCategory.error.message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
