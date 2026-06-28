import { render, screen, fireEvent } from '@testing-library/react-native';
import OrderDetailScreen from './[orderId]';
import { OrderStatusEnum } from '@old-st/contracts/order';

const mockConfirm = jest.fn();
const mockProcess = jest.fn();
const mockShip = jest.fn();
const mockDeliver = jest.fn();
const mockCancel = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ orderId: 'ord-12345678-abcd' }),
  Stack: { Screen: () => null },
}));

jest.mock('@old-st/client-common', () => ({
  useOrder: jest.fn(),
  useConfirmOrder: () => ({ mutate: mockConfirm, isPending: false }),
  useProcessOrder: () => ({ mutate: mockProcess, isPending: false }),
  useShipOrder: () => ({ mutate: mockShip, isPending: false }),
  useDeliverOrder: () => ({ mutate: mockDeliver, isPending: false }),
  useCancelOrder: () => ({ mutate: mockCancel, isPending: false }),
  formatOrderStatus: (s: string) => s,
  formatPaymentStatus: (s: string) => s,
}));

const { useOrder } = jest.requireMock('@old-st/client-common');

const baseOrder = {
  orderId: 'ord-12345678-abcd',
  customerId: 'cust-87654321-wxyz',
  items: [
    { itemId: 'i-1', productId: 'prod-11111111', productName: 'Widget', quantity: 2, price: 1000, latestKnownPrice: null },
  ],
  payment: null,
  totalAmount: 2000,
  dateCreated: '2025-06-15T00:00:00.000Z',
  updatedAt: '2025-06-16T00:00:00.000Z',
};

beforeEach(() => jest.clearAllMocks());

describe('OrderDetailScreen', () => {
  it('renders loading state when data is loading', () => {
    useOrder.mockReturnValue({ data: undefined, isLoading: true });

    render(<OrderDetailScreen />);

    expect(screen.queryByText(/Order #/)).toBeNull();
  });

  it('renders order details when loaded', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.PENDING },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    expect(screen.getByText('Order Details')).toBeTruthy();
    expect(screen.getByText('cust-87654321-wxyz')).toBeTruthy();
    expect(screen.getByText('$20.00')).toBeTruthy();
    expect(screen.getByText('PENDING')).toBeTruthy();
  });

  it('renders order items', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.PENDING },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    expect(screen.getByText('prod-111...')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('$10.00')).toBeTruthy();
  });

  it('renders payment info when present', () => {
    useOrder.mockReturnValue({
      data: {
        ...baseOrder,
        orderStatus: OrderStatusEnum.CONFIRMED,
        payment: {
          paymentId: 'pay-1',
          paymentMethod: 'CREDIT_CARD',
          paymentStatus: 'AUTHORIZED',
          amount: 2000,
          transactionId: 'txn-1',
        },
      },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    expect(screen.getByText('CREDIT_CARD')).toBeTruthy();
    expect(screen.getByText('AUTHORIZED')).toBeTruthy();
  });

  it('shows Confirm + Cancel for PENDING orders', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.PENDING },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel Order')).toBeTruthy();
    expect(screen.queryByText('Process')).toBeNull();
    expect(screen.queryByText('Ship')).toBeNull();
  });

  it('shows Process + Cancel for CONFIRMED orders', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.CONFIRMED },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    expect(screen.getByText('Process')).toBeTruthy();
    expect(screen.getByText('Cancel Order')).toBeTruthy();
    expect(screen.queryByText('Confirm')).toBeNull();
  });

  it('shows Ship for PROCESSING orders (no cancel)', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.PROCESSING },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    expect(screen.getByText('Ship')).toBeTruthy();
    expect(screen.queryByText('Cancel Order')).toBeNull();
  });

  it('shows Mark Delivered for SHIPPED orders', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.SHIPPED },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    expect(screen.getByText('Mark Delivered')).toBeTruthy();
  });

  it('shows Cancel for DRAFT orders', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.DRAFT },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    expect(screen.getByText('Cancel Order')).toBeTruthy();
    expect(screen.queryByText('Confirm')).toBeNull();
  });

  it('shows no actions for DELIVERED orders', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.DELIVERED },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    expect(screen.queryByText('Confirm')).toBeNull();
    expect(screen.queryByText('Process')).toBeNull();
    expect(screen.queryByText('Ship')).toBeNull();
    expect(screen.queryByText('Mark Delivered')).toBeNull();
    expect(screen.queryByText('Cancel Order')).toBeNull();
  });

  it('calls confirm mutation on Confirm press', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.PENDING },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    fireEvent.press(screen.getByText('Confirm'));
    expect(mockConfirm).toHaveBeenCalledWith('ord-12345678-abcd');
  });

  it('calls cancel mutation on Cancel press', () => {
    useOrder.mockReturnValue({
      data: { ...baseOrder, orderStatus: OrderStatusEnum.PENDING },
      isLoading: false,
    });

    render(<OrderDetailScreen />);

    fireEvent.press(screen.getByText('Cancel Order'));
    expect(mockCancel).toHaveBeenCalledWith('ord-12345678-abcd');
  });
});
