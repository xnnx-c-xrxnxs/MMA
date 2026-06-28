jest.mock('@old-st/client-common', () => ({
  useDeleteProduct: jest.fn(() => ({ mutate: jest.fn() })),
  useActivateProduct: jest.fn(() => ({ mutate: jest.fn() })),
  useDeactivateProduct: jest.fn(() => ({ mutate: jest.fn() })),
  useDiscontinueProduct: jest.fn(() => ({ mutate: jest.fn() })),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProductActions } from './product-actions';
import { useDeleteProduct, useActivateProduct, useDeactivateProduct, useDiscontinueProduct } from '@old-st/client-common';
import type { ProductResponse } from '@old-st/contracts/product';

function makeProduct(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    productId: 'p-1',
    name: 'Widget',
    description: '',
    categoryId: 'c-1',
    price: 10,
    inventory: 100,
    status: 'ACTIVE',
    dateCreated: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProductActions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should show Deactivate, Discontinue, Delete for ACTIVE product', () => {
    render(<ProductActions product={makeProduct({ status: 'ACTIVE' })} />);
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    expect(screen.getByText('Discontinue')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
  });

  it('should show Activate and Delete for INACTIVE product', () => {
    render(<ProductActions product={makeProduct({ status: 'INACTIVE' })} />);
    expect(screen.getByText('Activate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
  });

  it('should show no actions for DELETED product', () => {
    render(<ProductActions product={makeProduct({ status: 'DELETED' })} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
  });

  it('should call deactivateProduct on click', () => {
    const mockMutate = jest.fn();
    (useDeactivateProduct as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<ProductActions product={makeProduct({ status: 'ACTIVE' })} />);
    fireEvent.click(screen.getByText('Deactivate'));
    expect(mockMutate).toHaveBeenCalledWith('p-1');
  });

  it('should call activateProduct on click', () => {
    const mockMutate = jest.fn();
    (useActivateProduct as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<ProductActions product={makeProduct({ status: 'INACTIVE' })} />);
    fireEvent.click(screen.getByText('Activate'));
    expect(mockMutate).toHaveBeenCalledWith('p-1');
  });

  it('should call discontinueProduct on click', () => {
    const mockMutate = jest.fn();
    (useDiscontinueProduct as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<ProductActions product={makeProduct({ status: 'ACTIVE' })} />);
    fireEvent.click(screen.getByText('Discontinue'));
    expect(mockMutate).toHaveBeenCalledWith('p-1');
  });

  it('should call deleteProduct on click', () => {
    const mockMutate = jest.fn();
    (useDeleteProduct as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<ProductActions product={makeProduct({ status: 'INACTIVE' })} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(mockMutate).toHaveBeenCalledWith('p-1');
  });
});
