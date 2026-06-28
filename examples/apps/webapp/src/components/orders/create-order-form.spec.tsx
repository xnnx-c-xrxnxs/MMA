jest.mock('@old-st/client-common', () => ({
  useCreateOrder: jest.fn(),
  useUsersByStatus: jest.fn(),
  useProductsByStatus: jest.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreateOrderForm } from './create-order-form';
import { useCreateOrder, useUsersByStatus, useProductsByStatus } from '@old-st/client-common';

const mockUser = {
  userId: 'usr-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  userRole: 'USER' as const,
  userStatus: 'ACTIVE' as const,
  emailVerified: true,
  dateCreated: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockProduct = {
  productId: 'prod-1',
  name: 'Headphones',
  categoryId: 'cat-1',
  price: 99.99,
  inventory: 10,
  status: 'ACTIVE' as const,
  dateCreated: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('CreateOrderForm', () => {
  const mockMutate = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCreateOrder as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: false, isError: false });
    (useUsersByStatus as jest.Mock).mockReturnValue({ data: { data: [mockUser] }, isLoading: false });
    (useProductsByStatus as jest.Mock).mockReturnValue({ data: { data: [mockProduct] }, isLoading: false });
  });

  it('renders Customer and Product labels', () => {
    render(<CreateOrderForm onClose={mockOnClose} />);
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('shows customer and product options from hooks', () => {
    render(<CreateOrderForm onClose={mockOnClose} />);
    expect(screen.getByText('Alice Smith (alice@example.com)')).toBeInTheDocument();
    expect(screen.getByText(/Headphones — \$99.99/)).toBeInTheDocument();
  });

  it('Create button is disabled when no customer and product selected', () => {
    render(<CreateOrderForm onClose={mockOnClose} />);
    expect(screen.getByText('Create')).toBeDisabled();
  });

  it('shows loading text when users are loading', () => {
    (useUsersByStatus as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });
    render(<CreateOrderForm onClose={mockOnClose} />);
    expect(screen.getByText('Loading customers...')).toBeInTheDocument();
  });

  it('shows loading text when products are loading', () => {
    (useProductsByStatus as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });
    render(<CreateOrderForm onClose={mockOnClose} />);
    expect(screen.getByText('Loading products...')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<CreateOrderForm onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows error message when isError is true', () => {
    (useCreateOrder as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { message: 'Order creation failed' },
    });
    render(<CreateOrderForm onClose={mockOnClose} />);
    expect(screen.getByText('Order creation failed')).toBeInTheDocument();
  });

  it('disables submit and shows Creating... when isPending', () => {
    (useCreateOrder as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: true, isError: false });
    render(<CreateOrderForm onClose={mockOnClose} />);
    expect(screen.getByText('Creating...')).toBeDisabled();
  });

  it('submits the form with selected customer and product and calls onClose on success', () => {
    const capturedMutate = jest.fn((_input: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    (useCreateOrder as jest.Mock).mockReturnValue({ mutate: capturedMutate, isPending: false, isError: false });
    render(<CreateOrderForm onClose={mockOnClose} />);
    const customerSelect = screen.getByDisplayValue('Select a customer');
    fireEvent.change(customerSelect, { target: { value: 'usr-1' } });
    const productSelect = screen.getByDisplayValue('Select a product');
    fireEvent.change(productSelect, { target: { value: 'prod-1' } });
    const quantityInput = screen.getByDisplayValue('1');
    fireEvent.change(quantityInput, { target: { value: '2' } });
    fireEvent.submit(screen.getByTestId('create-order-form'));
    expect(capturedMutate).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'usr-1' }),
      expect.any(Object),
    );
    expect(mockOnClose).toHaveBeenCalled();
  });
});
