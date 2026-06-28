import { CancelOrderUseCase } from './cancel-order.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';
import { CannotCancelOrderError } from '../../../domain/exceptions';

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

function makeOrder(status: string) {
  return Order.reconstitute({
    orderId: 'ord-1',
    customerId: 'cust-1',
    items: [],
    payment: null,
    orderStatus: status as any,
    totalAmount: 0,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe('CancelOrderUseCase', () => {
  let useCase: CancelOrderUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new CancelOrderUseCase(mockRepo);
  });

  it('should cancel a DRAFT order', async () => {
    const order = makeOrder(OrderStatusEnum.DRAFT);
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute('ord-1');

    expect(result.getOrderStatus()).toBe(OrderStatusEnum.CANCELLED);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should cancel a CONFIRMED order', async () => {
    const order = makeOrder(OrderStatusEnum.CONFIRMED);
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute('ord-1');
    expect(result.getOrderStatus()).toBe(OrderStatusEnum.CANCELLED);
  });

  it('should throw InvalidInputError when orderId is empty', async () => {
    await expect(useCase.execute('')).rejects.toThrow(InvalidInputError);
  });

  it('should throw OrderNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(OrderNotFoundError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw when order is DELIVERED', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder(OrderStatusEnum.DELIVERED));

    await expect(useCase.execute('ord-1')).rejects.toThrow(CannotCancelOrderError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw when order is REFUNDED', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder(OrderStatusEnum.REFUNDED));

    await expect(useCase.execute('ord-1')).rejects.toThrow(CannotCancelOrderError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
