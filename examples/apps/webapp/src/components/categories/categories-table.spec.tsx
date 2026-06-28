jest.mock('@old-st/client-common', () => ({
  useDeleteCategory: jest.fn(() => ({ mutate: jest.fn() })),
  formatCategoryStatus: (s: string) => s,
}));

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoriesTable } from './categories-table';
import type { CategoryResponse } from '@old-st/contracts/product';

const mockCategories: CategoryResponse[] = [
  {
    categoryId: 'c-1',
    name: 'Electronics',
    description: 'Electronic devices',
    status: 'ACTIVE',
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    categoryId: 'c-2',
    name: 'Books',
    description: null as any,
    status: 'DELETED',
    dateCreated: '2024-02-01T00:00:00.000Z',
    updatedAt: '2024-02-01T00:00:00.000Z',
  },
];

describe('CategoriesTable', () => {
  it('should render category rows', () => {
    render(<CategoriesTable categories={mockCategories} />);
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Books')).toBeInTheDocument();
  });

  it('should render status badges', () => {
    render(<CategoriesTable categories={mockCategories} />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('DELETED')).toBeInTheDocument();
  });

  it('should not show Delete for DELETED categories', () => {
    render(<CategoriesTable categories={[mockCategories[1]]} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('should show Delete for ACTIVE categories', () => {
    render(<CategoriesTable categories={[mockCategories[0]]} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should show empty message when no categories', () => {
    render(<CategoriesTable categories={[]} />);
    expect(screen.getByText(/No categories found/)).toBeInTheDocument();
  });

  it('should link category name to detail page', () => {
    render(<CategoriesTable categories={mockCategories} />);
    const link = screen.getByText('Electronics').closest('a');
    expect(link).toHaveAttribute('href', '/products/categories/c-1');
  });
});
