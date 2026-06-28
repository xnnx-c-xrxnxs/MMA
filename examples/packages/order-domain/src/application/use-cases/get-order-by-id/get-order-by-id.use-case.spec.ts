import { GetOrderByIdUseCase } from './get-order-by-id.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderStatusEnum } from '../../../domain/constants';
import { InvalidInputError, OrderNotFoundError } from '../../exceptions';

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

function makeOrder(id = 'ord-123') {
  return Order.reconstitute({
    orderId: id,
    customerId: 'cust-1',
    items: [],
    payment: null,
    orderStatus: OrderStatusEnum.DRAFT,
    totalAmount: 0,
    dateCreated: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe('GetOrderByIdUseCase', () => {
  let useCase: GetOrderByIdUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new GetOrderByIdUseCase(mockRepo);
  });

  it('should return the order when found', async () => {
    const order = makeOrder();
    mockRepo.findById.mockResolvedValue(order);

    const result = await useCase.execute('ord-123');

    expect(result).toBe(order);
    expect(mockRepo.findById).toHaveBeenCalledWith('ord-123');
  });

  it('should throw InvalidInputError when orderId is empty', async () => {
    await expect(useCase.execute('')).rejects.toThrow(InvalidInputError);
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it('should throw OrderNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(OrderNotFoundError);
  });
});
