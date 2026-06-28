import { FailOrderValidationUseCase } from './fail-order-validation.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatusEnum } from '../../../domain/constants';
import { OrderNotFoundError } from '../../exceptions';
import { CannotFailValidationError } from '../../../domain/exceptions';

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

function makeReconstitutedOrder(
  overrides: Partial<{
    orderId: string;
    orderStatus: string;
  }> = {},
): Order {
  const now = new Date().toISOString();
  return Order.reconstitute({
    orderId: overrides.orderId ?? 'ord-1',
    customerId: 'cust-1',
    items: [],
    payment: null,
    orderStatus: (overrides.orderStatus as any) ?? OrderStatusEnum.DRAFT,
    totalAmount: 0,
    dateCreated: now,
    updatedAt: now,
  });
}

describe('FailOrderValidationUseCase', () => {
  let useCase: FailOrderValidationUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new FailOrderValidationUseCase(mockRepo);
  });

  it('should transition DRAFT → VALIDATION_FAILED', async () => {
    const order = makeReconstitutedOrder({ orderStatus: OrderStatusEnum.DRAFT });
    mockRepo.findById.mockResolvedValue(order);
    mockRepo.save.mockImplementation((o) => Promise.resolve(o));

    const result = await useCase.execute('ord-1');

    expect(result.getOrderStatus()).toBe(OrderStatusEnum.VALIDATION_FAILED);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw OrderNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(OrderNotFoundError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CannotFailValidationError when not DRAFT', async () => {
    const order = makeReconstitutedOrder({ orderStatus: OrderStatusEnum.PENDING });
    mockRepo.findById.mockResolvedValue(order);

    await expect(useCase.execute('ord-1')).rejects.toThrow(
      CannotFailValidationError,
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should throw CannotFailValidationError when CONFIRMED', async () => {
    const order = makeReconstitutedOrder({ orderStatus: OrderStatusEnum.CONFIRMED });
    mockRepo.findById.mockResolvedValue(order);

    await expect(useCase.execute('ord-1')).rejects.toThrow(
      CannotFailValidationError,
    );
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
