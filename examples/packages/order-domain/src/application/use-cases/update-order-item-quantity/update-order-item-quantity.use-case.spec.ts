import { UpdateOrderItemQuantityUseCase } from './update-order-item-quantity.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';
import { CannotModifyNonDraftOrderError, OrderItemNotFoundError } from '../../../domain/exceptions';

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

describe('UpdateOrderItemQuantityUseCase', () => {
  let useCase: UpdateOrderItemQuantityUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new UpdateOrderItemQuantityUseCase(mockRepo);
  });

  it('should update item quantity and recalculate total', async () => {
    const item = OrderItem.reconstitute({
      itemId: 'item-1',
      productId: 'p1',
      productName: 'Widget',
      quantity: 2,
      price: 10,
      latestKnownPrice: null,
      dateCreated: new Date().toISOString(),
    });
    const order = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [item],
      payment: null,
      orderStatus: OrderStatusEnum.DRAFT,
      totalAmount: 20,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute({ orderId: 'ord-1', itemId: 'item-1', quantity: 5 });

    expect(result.getTotalAmount()).toBe(50);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw InvalidInputError when orderId is empty', async () => {
    await expect(
      useCase.execute({ orderId: '', itemId: 'item-1', quantity: 3 }),
    ).rejects.toThrow(InvalidInputError);
  });

  it('should throw InvalidInputError when itemId is empty', async () => {
    await expect(
      useCase.execute({ orderId: 'ord-1', itemId: '', quantity: 3 }),
    ).rejects.toThrow(InvalidInputError);
  });

  it('should throw OrderNotFoundError when order not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ orderId: 'missing', itemId: 'item-1', quantity: 3 }),
    ).rejects.toThrow(OrderNotFoundError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when item not found', async () => {
    const order = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [],
      payment: null,
      orderStatus: OrderStatusEnum.DRAFT,
      totalAmount: 0,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(order);

    await expect(
      useCase.execute({ orderId: 'ord-1', itemId: 'nonexistent', quantity: 3 }),
    ).rejects.toThrow(OrderItemNotFoundError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
