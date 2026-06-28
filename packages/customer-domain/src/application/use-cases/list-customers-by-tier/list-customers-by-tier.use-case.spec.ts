import { ListCustomersByTierUseCase } from './list-customers-by-tier.use-case';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { CustomerTierEnum } from '../../../domain/constants';
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

describe('ListCustomersByTierUseCase', () => {
  let repo: ICustomerRepository;
  let useCase: ListCustomersByTierUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createMockRepository();
    useCase = new ListCustomersByTierUseCase(repo);
  });

  it('delegates to repository.listByTier', async () => {
    const paginated = {
      data: [],
      nextCursorPointer: null,
      prevCursorPointer: null,
    };
    (repo.listByTier as jest.Mock).mockResolvedValue(paginated);

    const result = await useCase.execute({
      tier: CustomerTierEnum.PRO,
      limit: 5,
    });

    expect(result).toBe(paginated);
    expect(repo.listByTier).toHaveBeenCalledWith(
      CustomerTierEnum.PRO,
      5,
      undefined,
      undefined,
      undefined,
    );
  });

  it('throws InvalidInputError when tier missing', async () => {
    await expect(useCase.execute({ tier: undefined as never })).rejects.toThrow(
      InvalidInputError,
    );
  });
});
