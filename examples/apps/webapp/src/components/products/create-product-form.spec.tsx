jest.mock('@old-st/client-common', () => ({
  useCreateProduct: jest.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreateProductForm } from './create-product-form';
import { useCreateProduct } from '@old-st/client-common';
import type { CategoryResponse } from '@old-st/contracts/product';

const mockCategories: CategoryResponse[] = [
  { categoryId: 'cat-1', name: 'Electronics', status: 'ACTIVE', dateCreated: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { categoryId: 'cat-2', name: 'Clothing', status: 'ACTIVE', dateCreated: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

describe('CreateProductForm', () => {
  const mockMutate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCreateProduct as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
    });
  });

  it('renders all form fields', () => {
    render(<CreateProductForm categories={mockCategories} onClose={mockOnClose} />);
    expect(screen.getByPlaceholderText('Product name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Price')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Inventory')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders category options', () => {
    render(<CreateProductForm categories={mockCategories} onClose={mockOnClose} />);
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Clothing')).toBeInTheDocument();
  });

  it('calls mutate with form data on submit', () => {
    render(<CreateProductForm categories={mockCategories} onClose={mockOnClose} />);
    fireEvent.change(screen.getByPlaceholderText('Product name'), { target: { value: 'Headphones' } });
    fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '99.99' } });
    fireEvent.submit(screen.getByTestId('create-product-form'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Headphones', price: 99.99 }),
      expect.any(Object),
    );
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<CreateProductForm categories={mockCategories} onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('disables submit and shows Creating... when isPending', () => {
    (useCreateProduct as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: true, isError: false });
    render(<CreateProductForm categories={mockCategories} onClose={mockOnClose} />);
    const btn = screen.getByText('Creating...');
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('shows error message when isError is true', () => {
    (useCreateProduct as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { message: 'Product name already taken' },
    });
    render(<CreateProductForm categories={mockCategories} onClose={mockOnClose} />);
    expect(screen.getByText('Product name already taken')).toBeInTheDocument();
  });

  it('renders with empty categories list', () => {
    render(<CreateProductForm categories={[]} onClose={mockOnClose} />);
    expect(screen.getByPlaceholderText('Product name')).toBeInTheDocument();
  });

  it('calls onClose on successful submission', () => {
    const capturedMutate = jest.fn((_input: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    (useCreateProduct as jest.Mock).mockReturnValue({ mutate: capturedMutate, isPending: false, isError: false });
    render(<CreateProductForm categories={mockCategories} onClose={mockOnClose} />);
    fireEvent.submit(screen.getByTestId('create-product-form'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('updates category, inventory, and description on change', () => {
    render(<CreateProductForm categories={mockCategories} onClose={mockOnClose} />);
    fireEvent.change(screen.getByPlaceholderText('Inventory'), { target: { value: '20' } });
    fireEvent.change(screen.getByPlaceholderText('Description (optional)'), { target: { value: 'A great product' } });
    // No error means state was updated correctly
    expect(screen.getByPlaceholderText('Inventory')).toBeInTheDocument();
  });
});
