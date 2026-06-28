jest.mock('@old-st/client-common', () => ({
  useDeleteProduct: jest.fn(() => ({ mutate: jest.fn() })),
  useActivateProduct: jest.fn(() => ({ mutate: jest.fn() })),
  useDeactivateProduct: jest.fn(() => ({ mutate: jest.fn() })),
  useDiscontinueProduct: jest.fn(() => ({ mutate: jest.fn() })),
  formatProductStatus: (s: string) => s,
}));

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProductsTable } from './products-table';
import type { ProductResponse } from '@old-st/contracts/product';

const mockProducts: ProductResponse[] = [
  {
    productId: 'p-1',
    name: 'Widget A',
    description: 'A fine widget',
    categoryId: 'cat-1',
    price: 29.99,
    inventory: 100,
    status: 'ACTIVE',
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  },
  {
    productId: 'p-2',
    name: 'Gadget B',
    categoryId: 'cat-2',
    price: 9.5,
    inventory: 0,
    status: 'INACTIVE',
    dateCreated: '2024-02-01T00:00:00.000Z',
    updatedAt: '2024-02-02T00:00:00.000Z',
  },
];

describe('ProductsTable', () => {
  it('should render product rows', () => {
    render(<ProductsTable products={mockProducts} />);
    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('Gadget B')).toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(<ProductsTable products={mockProducts} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('should render formatted prices', () => {
    render(<ProductsTable products={mockProducts} />);
    expect(screen.getByText('$29.99')).toBeInTheDocument();
    expect(screen.getByText('$9.50')).toBeInTheDocument();
  });

  it('should render badges for status', () => {
    render(<ProductsTable products={mockProducts} />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
  });

  it('should show empty message when no products', () => {
    render(<ProductsTable products={[]} />);
    expect(screen.getByText('No products found')).toBeInTheDocument();
  });

  it('should link product name to detail page', () => {
    render(<ProductsTable products={mockProducts} />);
    const link = screen.getByText('Widget A').closest('a');
    expect(link).toHaveAttribute('href', '/products/p-1');
  });
});
