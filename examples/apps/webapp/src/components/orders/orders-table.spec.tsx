jest.mock('@old-st/client-common', () => ({
  useDeleteOrder: jest.fn(() => ({ mutate: jest.fn() })),
  formatOrderStatus: (s: string) => s,
}));

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OrdersTable } from './orders-table';
import type { OrderResponse } from '@old-st/contracts/order';

const mockOrders: OrderResponse[] = [
  {
    orderId: 'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
    customerId: '11112222-3333-4444-5555-666677778888',
    orderStatus: 'PENDING',
    items: [
      { itemId: 'i-1', productId: 'p-1', productName: 'Widget', quantity: 2, price: 10, latestKnownPrice: 10 },
    ],
    totalAmount: 20,
    payment: null,
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

describe('OrdersTable', () => {
  it('should render order row with truncated IDs', () => {
    render(<OrdersTable orders={mockOrders} />);
    expect(screen.getByText('aaaabbbb...')).toBeInTheDocument();
    expect(screen.getByText('11112222...')).toBeInTheDocument();
  });

  it('should render status badge', () => {
    render(<OrdersTable orders={mockOrders} />);
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('should render total amount', () => {
    render(<OrdersTable orders={mockOrders} />);
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });

  it('should render items count', () => {
    render(<OrdersTable orders={mockOrders} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should show empty message when no orders', () => {
    render(<OrdersTable orders={[]} />);
    expect(screen.getByText('No orders found')).toBeInTheDocument();
  });

  it('should link order ID to detail page', () => {
    render(<OrdersTable orders={mockOrders} />);
    const link = screen.getByText('aaaabbbb...').closest('a');
    expect(link).toHaveAttribute('href', '/orders/aaaabbbb-cccc-dddd-eeee-ffffffffffff');
  });

  it('should not show delete button for non-DRAFT orders', () => {
    render(<OrdersTable orders={mockOrders} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});
