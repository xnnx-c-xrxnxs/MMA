import {
  CancelDraftOrdersByProductUseCase,
  CancelDraftOrdersByProductInput,
} from './cancel-draft-orders-by-product.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderStatusEnum } from '../../../domain/constants';

function createMockRepository() {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByCustomerId: jest.fn(),
    findByStatus: jest.fn(),
    findByProductId: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<IOrderRepository>;
}

function createDraftOrder(orderId: string, productId: string): Order {
  return Order.reconstitute({
    orderId,
    customerId: 'cust-1',
    items: [
      OrderItem.reconstitute({
        itemId: 'item-1',
        productId,
        productName: 'Widget',
        quantity: 2,
        price: 10,
        latestKnownPrice: null,
        dateCreated: new Date().toISOString(),
      }),
    ],
    payment: null,
    orderStatus: OrderStatusEnum.DRAFT,
    totalAmount: 20,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function createConfirmedOrder(orderId: string, productId: string): Order {
  return Order.reconstitute({
    orderId,
    customerId: 'cust-1',
    items: [
      OrderItem.reconstitute({
        itemId: 'item-1',
        productId,
        productName: 'Widget',
        quantity: 1,
        price: 15,
        latestKnownPrice: null,
        dateCreated: new Date().toISOString(),
      }),
    ],
    payment: null,
    orderStatus: OrderStatusEnum.CONFIRMED,
    totalAmount: 15,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe('CancelDraftOrdersByProductUseCase', () => {
  let useCase: CancelDraftOrdersByProductUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new CancelDraftOrdersByProductUseCase(mockRepo);
  });

  it('should cancel all DRAFT orders containing the product', async () => {
    const draftOrder1 = createDraftOrder('ord-1', 'prod-abc');
    const draftOrder2 = createDraftOrder('ord-2', 'prod-abc');

    mockRepo.findByProductId.mockResolvedValueOnce({
      data: [draftOrder1, draftOrder2],
      total: 2,
      page: 1,
      limit: 50,
      totalPages: 1,
    });

    mockRepo.save.mockImplementation((order) => Promise.resolve(order));

    const result = await useCase.execute({ productId: 'prod-abc' });

    expect(result.cancelledOrderIds).toEqual(['ord-1', 'ord-2']);
    expect(mockRepo.save).toHaveBeenCalledTimes(2);
    expect(mockRepo.findByProductId).toHaveBeenCalledWith('prod-abc', 1, 50);
  });

  it('should skip non-DRAFT orders', async () => {
    const draftOrder = createDraftOrder('ord-1', 'prod-abc');
    const confirmedOrder = createConfirmedOrder('ord-2', 'prod-abc');

    mockRepo.findByProductId.mockResolvedValueOnce({
      data: [draftOrder, confirmedOrder],
      total: 2,
      page: 1,
      limit: 50,
      totalPages: 1,
    });

    mockRepo.save.mockImplementation((order) => Promise.resolve(order));

    const result = await useCase.execute({ productId: 'prod-abc' });

    expect(result.cancelledOrderIds).toEqual(['ord-1']);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when no orders contain the product', async () => {
    mockRepo.findByProductId.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });

    const result = await useCase.execute({ productId: 'prod-none' });

    expect(result.cancelledOrderIds).toEqual([]);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should paginate through multiple pages', async () => {
    const draftOrder1 = createDraftOrder('ord-1', 'prod-abc');
    const draftOrder2 = createDraftOrder('ord-2', 'prod-abc');

    mockRepo.findByProductId
      .mockResolvedValueOnce({
        data: [draftOrder1],
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        data: [draftOrder2],
        total: 2,
        page: 2,
        limit: 50,
        totalPages: 2,
      });

    mockRepo.save.mockImplementation((order) => Promise.resolve(order));

    const result = await useCase.execute({ productId: 'prod-abc' });

    expect(result.cancelledOrderIds).toEqual(['ord-1', 'ord-2']);
    expect(mockRepo.findByProductId).toHaveBeenCalledTimes(2);
    expect(mockRepo.findByProductId).toHaveBeenCalledWith('prod-abc', 1, 50);
    expect(mockRepo.findByProductId).toHaveBeenCalledWith('prod-abc', 2, 50);
  });

  it('should propagate repository errors', async () => {
    mockRepo.findByProductId.mockRejectedValue(new Error('DB error'));

    await expect(
      useCase.execute({ productId: 'prod-abc' }),
    ).rejects.toThrow('DB error');
  });
});
