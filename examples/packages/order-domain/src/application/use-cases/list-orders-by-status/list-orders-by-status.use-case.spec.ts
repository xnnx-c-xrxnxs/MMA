import { ListOrdersByStatusUseCase } from './list-orders-by-status.use-case';
import { IOrderRepository } from '../../interfaces/order-repository.interface';
import { InvalidInputError, InvalidOrderStatusError } from '../../exceptions';

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

describe('ListOrdersByStatusUseCase', () => {
  let useCase: ListOrdersByStatusUseCase;
  let mockRepo: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockRepository();
    useCase = new ListOrdersByStatusUseCase(mockRepo);
  });

  it('should return paginated orders by status', async () => {
    const paginatedResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    };
    mockRepo.findByStatus.mockResolvedValue(paginatedResult);

    const result = await useCase.execute({ status: 'CONFIRMED' });

    expect(result).toBe(paginatedResult);
    expect(mockRepo.findByStatus).toHaveBeenCalledWith(
      'CONFIRMED',
      undefined,
      undefined,
    );
  });

  it('should throw InvalidInputError when status is empty', async () => {
    await expect(
      useCase.execute({ status: '' as any }),
    ).rejects.toThrow(InvalidInputError);
    expect(mockRepo.findByStatus).not.toHaveBeenCalled();
  });

  it('should throw InvalidOrderStatusError for unknown status', async () => {
    await expect(
      useCase.execute({ status: 'UNKNOWN' as any }),
    ).rejects.toThrow(InvalidOrderStatusError);
    expect(mockRepo.findByStatus).not.toHaveBeenCalled();
  });
});
