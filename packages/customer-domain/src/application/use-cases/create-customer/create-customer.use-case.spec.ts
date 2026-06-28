import { CreateCustomerUseCase } from './create-customer.use-case';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { CustomerAlreadyExistsError } from '../../exceptions';

function createMockRepository(
  overrides: Partial<ICustomerRepository> = {},
): ICustomerRepository {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByEmail: jest.fn(),
    listByStatus: jest.fn(),
    listByTier: jest.fn(),
    ...overrides,
  } as unknown as ICustomerRepository;
}

describe('CreateCustomerUseCase', () => {
  let repo: ICustomerRepository;
  let useCase: CreateCustomerUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createMockRepository();
    useCase = new CreateCustomerUseCase(repo);
  });

  it('creates and persists when email is unique', async () => {
    (repo.findByEmail as jest.Mock).mockResolvedValue(null);
    (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve(c));

    const result = await useCase.execute({
      name: 'Acme Contact',
      email: 'jane@acme.com',
    });

    expect(result.getEmail()).toBe('jane@acme.com');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('throws CustomerAlreadyExistsError when email is taken', async () => {
    (repo.findByEmail as jest.Mock).mockResolvedValue({} as never);

    await expect(
      useCase.execute({ name: 'A', email: 'taken@acme.com' }),
    ).rejects.toThrow(CustomerAlreadyExistsError);

    expect(repo.save).not.toHaveBeenCalled();
  });
});
