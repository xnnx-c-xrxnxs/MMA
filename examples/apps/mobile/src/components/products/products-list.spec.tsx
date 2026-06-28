import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProductsList } from './products-list';
import type { ProductResponse } from '@old-st/contracts/product';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockProduct: ProductResponse = {
  productId: 'p-1',
  name: 'Widget A',
  description: 'A fine widget',
  categoryId: 'cat-1',
  price: 1999,
  inventory: 50,
  status: 'ACTIVE',
  dateCreated: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

const mockProduct2: ProductResponse = {
  productId: 'p-2',
  name: 'Gadget B',
  description: 'A cool gadget',
  categoryId: 'cat-2',
  price: 4500,
  inventory: 0,
  status: 'INACTIVE',
  dateCreated: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

beforeEach(() => jest.clearAllMocks());

describe('ProductsList', () => {
  it('renders product items with name, description, price and status', () => {
    render(<ProductsList products={[mockProduct, mockProduct2]} isLoading={false} />);

    expect(screen.getByText('Widget A')).toBeTruthy();
    expect(screen.getByText('A fine widget')).toBeTruthy();
    expect(screen.getByText('Price: $19.99')).toBeTruthy();
    expect(screen.getByText('Stock: 50')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();

    expect(screen.getByText('Gadget B')).toBeTruthy();
    expect(screen.getByText('Inactive')).toBeTruthy();
  });

  it('shows loading indicator when loading with no data', () => {
    render(<ProductsList products={[]} isLoading={true} />);

    expect(screen.queryByText('No products found')).toBeNull();
  });

  it('shows empty message when no products and not loading', () => {
    render(<ProductsList products={[]} isLoading={false} />);

    expect(screen.getByText('No products found')).toBeTruthy();
  });

  it('navigates to product detail on press', () => {
    render(<ProductsList products={[mockProduct]} isLoading={false} />);

    fireEvent.press(screen.getByText('Widget A'));
    expect(mockPush).toHaveBeenCalledWith('/products/p-1');
  });
});
