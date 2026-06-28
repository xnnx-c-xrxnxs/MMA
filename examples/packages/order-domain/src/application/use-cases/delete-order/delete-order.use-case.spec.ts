import { DeleteOrderUseCase } from './delete-order.use-case';
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

describe('DeleteOrderUseCase', () => {
  let useCase: DeleteOrderUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new DeleteOrderUseCase(mockRepo);
  });

  it('should delete a DRAFT order', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder(OrderStatusEnum.DRAFT));
    mockRepo.delete.mockResolvedValue(undefined);

    await useCase.execute('ord-1');

    expect(mockRepo.findById).toHaveBeenCalledWith('ord-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('ord-1');
  });

  it('should delete a CANCELLED order', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder(OrderStatusEnum.CANCELLED));
    mockRepo.delete.mockResolvedValue(undefined);

    await useCase.execute('ord-1');

    expect(mockRepo.delete).toHaveBeenCalledWith('ord-1');
  });

  it('should throw InvalidInputError when orderId is empty', async () => {
    await expect(useCase.execute('')).rejects.toThrow(InvalidInputError);
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it('should throw OrderNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(OrderNotFoundError);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should throw InvalidInputError when order is CONFIRMED', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder(OrderStatusEnum.CONFIRMED));

    await expect(useCase.execute('ord-1')).rejects.toThrow(InvalidInputError);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should throw InvalidInputError when order is DELIVERED', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder(OrderStatusEnum.DELIVERED));

    await expect(useCase.execute('ord-1')).rejects.toThrow(InvalidInputError);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });
});
