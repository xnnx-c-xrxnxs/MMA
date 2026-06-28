import { ListCustomersByStatusUseCase } from './list-customers-by-status.use-case';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { CustomerStatusEnum } from '../../../domain/constants';
import { InvalidInputError } from '../../exceptions';

function createMockRepository(): ICustomerRepository {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByEmail: jest.fn(),
    listByStatus: jest.fn(),
    listByTier: jest.fn(),
  } as unknown as ICustomerRepository;
}

describe('ListCustomersByStatusUseCase', () => {
  let repo: ICustomerRepository;
  let useCase: ListCustomersByStatusUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createMockRepository();
    useCase = new ListCustomersByStatusUseCase(repo);
  });

  it('delegates to repository.listByStatus', async () => {
    const paginated = {
      data: [],
      nextCursorPointer: null,
      prevCursorPointer: null,
    };
    (repo.listByStatus as jest.Mock).mockResolvedValue(paginated);

    const result = await useCase.execute({
      status: CustomerStatusEnum.ACTIVE,
      limit: 10,
    });

    expect(result).toBe(paginated);
    expect(repo.listByStatus).toHaveBeenCalledWith(
      CustomerStatusEnum.ACTIVE,
      10,
      undefined,
      undefined,
      undefined,
    );
  });

  it('throws InvalidInputError when status missing', async () => {
    await expect(
      useCase.execute({ status: undefined as never }),
    ).rejects.toThrow(InvalidInputError);
  });
});
