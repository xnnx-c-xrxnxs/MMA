import {
  UpdateItemLatestPriceUseCase,
  UpdateItemLatestPriceInput,
} from './update-item-latest-price.use-case';
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

function createDraftOrderWithProduct(
  orderId: string,
  productId: string,
  price: number,
): Order {
  return Order.reconstitute({
    orderId,
    customerId: 'cust-1',
    items: [
      OrderItem.reconstitute({
        itemId: 'item-1',
        productId,
        productName: 'Widget',
        quantity: 2,
        price,
        latestKnownPrice: null,
        dateCreated: new Date().toISOString(),
      }),
    ],
    payment: null,
    orderStatus: OrderStatusEnum.DRAFT,
    totalAmount: price * 2,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe('UpdateItemLatestPriceUseCase', () => {
  let useCase: UpdateItemLatestPriceUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new UpdateItemLatestPriceUseCase(mockRepo);
  });

  it('should update latestKnownPrice on matching items in DRAFT orders', async () => {
    const order = createDraftOrderWithProduct('ord-1', 'prod-abc', 10);

    mockRepo.findByProductId.mockResolvedValueOnce({
      data: [order],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    });

    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute({
      productId: 'prod-abc',
      newPrice: 15,
    });

    expect(result.updatedOrderIds).toEqual(['ord-1']);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);

    const savedOrder = mockRepo.save.mock.calls[0][0];
    const items = savedOrder.getItems();
    expect(items[0].getLatestKnownPrice()).toBe(15);
  });

  it('should skip non-DRAFT orders', async () => {
    const confirmedOrder = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [
        OrderItem.reconstitute({
          itemId: 'item-1',
          productId: 'prod-abc',
          productName: 'Widget',
          quantity: 1,
          price: 10,
          latestKnownPrice: null,
          dateCreated: new Date().toISOString(),
        }),
      ],
      payment: null,
      orderStatus: OrderStatusEnum.CONFIRMED,
      totalAmount: 10,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    mockRepo.findByProductId.mockResolvedValueOnce({
      data: [confirmedOrder],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    });

    const result = await useCase.execute({
      productId: 'prod-abc',
      newPrice: 15,
    });

    expect(result.updatedOrderIds).toEqual([]);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should not save order if no items match the productId', async () => {
    const orderWithDifferentProduct = createDraftOrderWithProduct(
      'ord-1',
      'prod-xyz',
      10,
    );

    mockRepo.findByProductId.mockResolvedValueOnce({
      data: [orderWithDifferentProduct],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    });

    const result = await useCase.execute({
      productId: 'prod-abc',
      newPrice: 15,
    });

    expect(result.updatedOrderIds).toEqual([]);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should return empty array when no orders found', async () => {
    mockRepo.findByProductId.mockResolvedValueOnce({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });

    const result = await useCase.execute({
      productId: 'prod-none',
      newPrice: 15,
    });

    expect(result.updatedOrderIds).toEqual([]);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should paginate through multiple pages', async () => {
    const order1 = createDraftOrderWithProduct('ord-1', 'prod-abc', 10);
    const order2 = createDraftOrderWithProduct('ord-2', 'prod-abc', 10);

    mockRepo.findByProductId
      .mockResolvedValueOnce({
        data: [order1],
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        data: [order2],
        total: 2,
        page: 2,
        limit: 50,
        totalPages: 2,
      });

    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute({
      productId: 'prod-abc',
      newPrice: 20,
    });

    expect(result.updatedOrderIds).toEqual(['ord-1', 'ord-2']);
    expect(mockRepo.findByProductId).toHaveBeenCalledTimes(2);
  });

  it('should propagate repository errors', async () => {
    mockRepo.findByProductId.mockRejectedValue(new Error('DB error'));

    await expect(
      useCase.execute({ productId: 'prod-abc', newPrice: 15 }),
    ).rejects.toThrow('DB error');
  });
});
