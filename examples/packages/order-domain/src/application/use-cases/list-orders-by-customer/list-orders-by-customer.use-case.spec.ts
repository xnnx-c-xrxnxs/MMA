import { ListOrdersByCustomerUseCase } from './list-orders-by-customer.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { InvalidInputError } from '../../exceptions';

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

describe('ListOrdersByCustomerUseCase', () => {
  let useCase: ListOrdersByCustomerUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new ListOrdersByCustomerUseCase(mockRepo);
  });

  it('should return paginated orders for a customer', async () => {
    const paginatedResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    };
    mockRepo.findByCustomerId.mockResolvedValue(paginatedResult);

    const result = await useCase.execute({ customerId: 'cust-1' });

    expect(result).toBe(paginatedResult);
    expect(mockRepo.findByCustomerId).toHaveBeenCalledWith(
      'cust-1',
      undefined,
      undefined,
    );
  });

  it('should pass pagination params through', async () => {
    const paginatedResult = {
      data: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    };
    mockRepo.findByCustomerId.mockResolvedValue(paginatedResult);

    await useCase.execute({
      customerId: 'cust-1',
      page: 2,
      limit: 10,
    });

    expect(mockRepo.findByCustomerId).toHaveBeenCalledWith(
      'cust-1',
      2,
      10,
    );
  });

  it('should throw InvalidInputError when customerId is empty', async () => {
    await expect(
      useCase.execute({ customerId: '' }),
    ).rejects.toThrow(InvalidInputError);
    expect(mockRepo.findByCustomerId).not.toHaveBeenCalled();
  });
});
