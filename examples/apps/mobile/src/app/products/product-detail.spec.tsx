import { render, screen, fireEvent } from '@testing-library/react-native';
import ProductDetailScreen from './[productId]';
import { ProductStatusEnum } from '@old-st/contracts/product';

const mockActivate = jest.fn();
const mockDeactivate = jest.fn();
const mockDiscontinue = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ productId: 'p-1' }),
  Stack: { Screen: () => null },
}));

jest.mock('@old-st/client-common', () => ({
  useProduct: jest.fn(),
  useActivateProduct: () => ({ mutate: mockActivate, isPending: false }),
  useDeactivateProduct: () => ({ mutate: mockDeactivate, isPending: false }),
  useDiscontinueProduct: () => ({ mutate: mockDiscontinue, isPending: false }),
  formatProductStatus: (s: string) => s,
}));

const { useProduct } = jest.requireMock('@old-st/client-common');

const baseProduct = {
  productId: 'p-1',
  name: 'Widget A',
  description: 'A fine widget',
  categoryId: 'cat-1',
  price: 1999,
  inventory: 50,
  dateCreated: '2025-06-15T00:00:00.000Z',
  updatedAt: '2025-06-16T00:00:00.000Z',
};

beforeEach(() => jest.clearAllMocks());

describe('ProductDetailScreen', () => {
  it('renders loading state when data is loading', () => {
    useProduct.mockReturnValue({ data: undefined, isLoading: true });

    render(<ProductDetailScreen />);

    expect(screen.queryByText('Widget A')).toBeNull();
  });

  it('renders product details when loaded', () => {
    useProduct.mockReturnValue({
      data: { ...baseProduct, status: ProductStatusEnum.ACTIVE },
      isLoading: false,
    });

    render(<ProductDetailScreen />);

    expect(screen.getByText('Widget A')).toBeTruthy();
    expect(screen.getByText('A fine widget')).toBeTruthy();
    expect(screen.getByText('$19.99')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('shows Deactivate + Discontinue for ACTIVE products', () => {
    useProduct.mockReturnValue({
      data: { ...baseProduct, status: ProductStatusEnum.ACTIVE },
      isLoading: false,
    });

    render(<ProductDetailScreen />);

    expect(screen.getByText('Deactivate')).toBeTruthy();
    expect(screen.getByText('Discontinue')).toBeTruthy();
    expect(screen.queryByText('Activate')).toBeNull();
  });

  it('shows Activate for INACTIVE products', () => {
    useProduct.mockReturnValue({
      data: { ...baseProduct, status: ProductStatusEnum.INACTIVE },
      isLoading: false,
    });

    render(<ProductDetailScreen />);

    expect(screen.getByText('Activate')).toBeTruthy();
    expect(screen.queryByText('Deactivate')).toBeNull();
    expect(screen.queryByText('Discontinue')).toBeNull();
  });

  it('shows no actions for DISCONTINUED products', () => {
    useProduct.mockReturnValue({
      data: { ...baseProduct, status: ProductStatusEnum.DISCONTINUED },
      isLoading: false,
    });

    render(<ProductDetailScreen />);

    expect(screen.queryByText('Activate')).toBeNull();
    expect(screen.queryByText('Deactivate')).toBeNull();
    expect(screen.queryByText('Discontinue')).toBeNull();
  });

  it('calls activate mutation on Activate press', () => {
    useProduct.mockReturnValue({
      data: { ...baseProduct, status: ProductStatusEnum.INACTIVE },
      isLoading: false,
    });

    render(<ProductDetailScreen />);

    fireEvent.press(screen.getByText('Activate'));
    expect(mockActivate).toHaveBeenCalledWith('p-1');
  });

  it('calls deactivate mutation on Deactivate press', () => {
    useProduct.mockReturnValue({
      data: { ...baseProduct, status: ProductStatusEnum.ACTIVE },
      isLoading: false,
    });

    render(<ProductDetailScreen />);

    fireEvent.press(screen.getByText('Deactivate'));
    expect(mockDeactivate).toHaveBeenCalledWith('p-1');
  });

  it('calls discontinue mutation on Discontinue press', () => {
    useProduct.mockReturnValue({
      data: { ...baseProduct, status: ProductStatusEnum.ACTIVE },
      isLoading: false,
    });

    render(<ProductDetailScreen />);

    fireEvent.press(screen.getByText('Discontinue'));
    expect(mockDiscontinue).toHaveBeenCalledWith('p-1');
  });
});
