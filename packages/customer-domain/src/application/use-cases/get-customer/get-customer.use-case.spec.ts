import { GetCustomerUseCase } from './get-customer.use-case';
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

describe('GetCustomerUseCase', () => {
  let repo: ICustomerRepository;
  let useCase: GetCustomerUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createMockRepository();
    useCase = new GetCustomerUseCase(repo);
  });

  it('returns the customer when found', async () => {
    const customer = Customer.create({ name: 'A', email: 'a@b.com' });
    (repo.findById as jest.Mock).mockResolvedValue(customer);

    const result = await useCase.execute('cust-1');
    expect(result).toBe(customer);
  });

  it('throws InvalidInputError when id missing', async () => {
    await expect(useCase.execute('')).rejects.toThrow(InvalidInputError);
  });

  it('throws CustomerNotFoundError when not found', async () => {
    (repo.findById as jest.Mock).mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(
      CustomerNotFoundError,
    );
  });
});
