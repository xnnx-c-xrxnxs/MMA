'use client';

import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@old-st/ui';
import { useDeleteCategory, formatCategoryStatus } from '@old-st/client-common';
import { categoryStatusVariant } from '@/lib/status-variants';
import type { CategoryResponse } from '@old-st/contracts/product';
import { CategoryStatusEnum } from '@old-st/contracts/product';
import Link from 'next/link';

export function CategoriesTable({ categories }: { categories: CategoryResponse[] }) {
  const deleteCategory = useDeleteCategory();

  return (
    <Table data-testid="categories-table">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.categoryId}>
            <TableCell>
              <Link
                href={`/products/categories/${category.categoryId}`}
                className="font-medium hover:underline"
              >
                {category.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-xs truncate">
              {category.description || '—'}
            </TableCell>
            <TableCell>
              <Badge variant={categoryStatusVariant(category.status)}>
                {formatCategoryStatus(category.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(category.dateCreated).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              {category.status !== CategoryStatusEnum.DELETED && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteCategory.mutate(category.categoryId)}
                >
                  Delete
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
        {categories.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center text-muted-foreground"
            >
              No categories found. Create one to get started.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
