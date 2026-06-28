import { GetCustomerByUserIdUseCase } from './get-customer-by-user-id.use-case';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import {
  CustomerNotFoundError,
  InvalidInputError,
} from '../../exceptions';

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

describe('GetCustomerByUserIdUseCase', () => {
  let repo: ICustomerRepository;
  let useCase: GetCustomerByUserIdUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createMockRepository();
    useCase = new GetCustomerByUserIdUseCase(repo);
  });

  it('returns the customer when found via userId', async () => {
    const customer = Customer.create({ name: 'A', email: 'a@b.com' });
    (repo.findByUserId as jest.Mock).mockResolvedValue(customer);

    const result = await useCase.execute('user-1');
    expect(result).toBe(customer);
    expect(repo.findByUserId).toHaveBeenCalledWith('user-1');
  });

  it('throws InvalidInputError when userId missing', async () => {
    await expect(useCase.execute('')).rejects.toThrow(InvalidInputError);
  });

  it('throws CustomerNotFoundError when not found', async () => {
    (repo.findByUserId as jest.Mock).mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(
      CustomerNotFoundError,
    );
  });
});
