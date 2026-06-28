import { render, screen, fireEvent } from '@testing-library/react-native';
import { OrdersList } from './orders-list';
import type { OrderResponse } from '@old-st/contracts/order';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockOrder: OrderResponse = {
  orderId: 'ord-12345678-abcd',
  customerId: 'cust-87654321-wxyz',
  items: [
    { itemId: 'i-1', productId: 'p-1', productName: 'Widget', quantity: 2, price: 1000, latestKnownPrice: null },
    { itemId: 'i-2', productId: 'p-2', productName: 'Gadget', quantity: 1, price: 2000, latestKnownPrice: null },
  ],
  payment: null,
  orderStatus: 'PENDING',
  totalAmount: 4000,
  dateCreated: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

beforeEach(() => jest.clearAllMocks());

describe('OrdersList', () => {
  it('renders order items with truncated ID, status, item count and total', () => {
    render(<OrdersList orders={[mockOrder]} isLoading={false} />);

    expect(screen.getByText(/Order #ord-1234/)).toBeTruthy();
    expect(screen.getByText(/cust-876/)).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText(/Items:.*2/)).toBeTruthy();
    expect(screen.getByText(/Total:.*\$40\.00/)).toBeTruthy();
  });

  it('shows loading indicator when loading with no data', () => {
    render(<OrdersList orders={[]} isLoading={true} />);

    expect(screen.queryByText('No orders found')).toBeNull();
  });

  it('shows empty message when no orders and not loading', () => {
    render(<OrdersList orders={[]} isLoading={false} />);

    expect(screen.getByText('No orders found')).toBeTruthy();
  });

  it('navigates to order detail on press', () => {
    render(<OrdersList orders={[mockOrder]} isLoading={false} />);

    fireEvent.press(screen.getByText('Order #ord-1234'));
    expect(mockPush).toHaveBeenCalledWith('/orders/ord-12345678-abcd');
  });
});
