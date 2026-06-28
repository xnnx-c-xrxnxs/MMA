import { RemoveOrderItemUseCase } from './remove-order-item.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';
import { CannotModifyNonDraftOrderError } from '../../../domain/exceptions';

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

describe('RemoveOrderItemUseCase', () => {
  let useCase: RemoveOrderItemUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new RemoveOrderItemUseCase(mockRepo);
  });

  it('should remove an item from a draft order', async () => {
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

    const result = await useCase.execute({ orderId: 'ord-1', itemId: 'item-1' });

    expect(result.getItems()).toHaveLength(0);
    expect(result.getTotalAmount()).toBe(0);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw InvalidInputError when orderId is empty', async () => {
    await expect(
      useCase.execute({ orderId: '', itemId: 'item-1' }),
    ).rejects.toThrow(InvalidInputError);
  });

  it('should throw InvalidInputError when itemId is empty', async () => {
    await expect(
      useCase.execute({ orderId: 'ord-1', itemId: '' }),
    ).rejects.toThrow(InvalidInputError);
  });

  it('should throw OrderNotFoundError when order not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ orderId: 'missing', itemId: 'item-1' }),
    ).rejects.toThrow(OrderNotFoundError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should propagate domain error when order is not DRAFT', async () => {
    const order = Order.reconstitute({
      orderId: 'ord-1',
      customerId: 'cust-1',
      items: [],
      payment: null,
      orderStatus: OrderStatusEnum.SHIPPED,
      totalAmount: 0,
      dateCreated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockRepo.findById.mockResolvedValue(order);

    await expect(
      useCase.execute({ orderId: 'ord-1', itemId: 'item-1' }),
    ).rejects.toThrow(CannotModifyNonDraftOrderError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
