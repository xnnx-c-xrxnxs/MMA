jest.mock('@old-st/client-common', () => ({
  useConfirmOrder: jest.fn(() => ({ mutate: jest.fn() })),
  useProcessOrder: jest.fn(() => ({ mutate: jest.fn() })),
  useShipOrder: jest.fn(() => ({ mutate: jest.fn() })),
  useDeliverOrder: jest.fn(() => ({ mutate: jest.fn() })),
  useCancelOrder: jest.fn(() => ({ mutate: jest.fn() })),
  useRefundOrder: jest.fn(() => ({ mutate: jest.fn() })),
  useDeleteOrder: jest.fn(() => ({ mutate: jest.fn() })),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OrderActions } from './order-actions';
import { useCancelOrder, useConfirmOrder, useDeleteOrder, useDeliverOrder, useProcessOrder, useRefundOrder, useShipOrder } from '@old-st/client-common';

describe('OrderActions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should show Delete and Cancel for DRAFT order', () => {
    render(<OrderActions orderId="o-1" orderStatus="DRAFT" />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
  });

  it('should show Confirm and Cancel for PENDING order', () => {
    render(<OrderActions orderId="o-1" orderStatus="PENDING" />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('should show Process and Cancel for CONFIRMED order', () => {
    render(<OrderActions orderId="o-1" orderStatus="CONFIRMED" />);
    expect(screen.getByText('Process')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should show Ship and Cancel for PROCESSING order', () => {
    render(<OrderActions orderId="o-1" orderStatus="PROCESSING" />);
    expect(screen.getByText('Ship')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should show Deliver and Cancel for SHIPPED order', () => {
    render(<OrderActions orderId="o-1" orderStatus="SHIPPED" />);
    expect(screen.getByText('Deliver')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should show Refund for DELIVERED order', () => {
    render(<OrderActions orderId="o-1" orderStatus="DELIVERED" />);
    expect(screen.getByText('Refund')).toBeInTheDocument();
    // Cancel should NOT show for DELIVERED
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('should show no actions for CANCELLED order', () => {
    render(<OrderActions orderId="o-1" orderStatus="CANCELLED" />);
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
  });

  it('should call confirmOrder on click', () => {
    const mockMutate = jest.fn();
    (useConfirmOrder as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<OrderActions orderId="o-1" orderStatus="PENDING" />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(mockMutate).toHaveBeenCalledWith('o-1');
  });

  it('should call cancelOrder on click', () => {
    const mockMutate = jest.fn();
    (useCancelOrder as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<OrderActions orderId="o-1" orderStatus="PENDING" />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockMutate).toHaveBeenCalledWith('o-1');
  });

  it('should call processOrder on click', () => {
    const mockMutate = jest.fn();
    (useProcessOrder as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<OrderActions orderId="o-1" orderStatus="CONFIRMED" />);
    fireEvent.click(screen.getByText('Process'));
    expect(mockMutate).toHaveBeenCalledWith('o-1');
  });

  it('should call shipOrder on click', () => {
    const mockMutate = jest.fn();
    (useShipOrder as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<OrderActions orderId="o-1" orderStatus="PROCESSING" />);
    fireEvent.click(screen.getByText('Ship'));
    expect(mockMutate).toHaveBeenCalledWith('o-1');
  });

  it('should call deliverOrder on click', () => {
    const mockMutate = jest.fn();
    (useDeliverOrder as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<OrderActions orderId="o-1" orderStatus="SHIPPED" />);
    fireEvent.click(screen.getByText('Deliver'));
    expect(mockMutate).toHaveBeenCalledWith('o-1');
  });

  it('should call refundOrder on click', () => {
    const mockMutate = jest.fn();
    (useRefundOrder as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<OrderActions orderId="o-1" orderStatus="DELIVERED" />);
    fireEvent.click(screen.getByText('Refund'));
    expect(mockMutate).toHaveBeenCalledWith('o-1');
  });

  it('should call deleteOrder on click', () => {
    const mockMutate = jest.fn();
    (useDeleteOrder as jest.Mock).mockReturnValue({ mutate: mockMutate });
    render(<OrderActions orderId="o-1" orderStatus="DRAFT" />);
    fireEvent.click(screen.getByText('Delete'));
    expect(mockMutate).toHaveBeenCalledWith('o-1');
  });
});
