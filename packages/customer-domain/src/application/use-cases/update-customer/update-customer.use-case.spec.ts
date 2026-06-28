import { UpdateCustomerUseCase } from './update-customer.use-case';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import {
  CustomerNotFoundError,
  InvalidInputError,
} from '../../exceptions';
import { CustomerTierEnum } from '../../../domain/constants';

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

describe('UpdateCustomerUseCase', () => {
  let repo: ICustomerRepository;
  let useCase: UpdateCustomerUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createMockRepository();
    useCase = new UpdateCustomerUseCase(repo);
  });

  it('updates profile fields and saves', async () => {
    const customer = Customer.create({ name: 'A', email: 'a@b.com' });
    (repo.findById as jest.Mock).mockResolvedValue(customer);
    (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve(c));

    const result = await useCase.execute({
      customerId: 'cust-1',
      name: 'New Name',
      tier: 'PRO',
    });

    expect(result.getName()).toBe('New Name');
    expect(result.getTier()).toBe(CustomerTierEnum.PRO);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('does not change email (immutable)', async () => {
    const customer = Customer.create({ name: 'A', email: 'a@b.com' });
    (repo.findById as jest.Mock).mockResolvedValue(customer);
    (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve(c));

    const result = await useCase.execute({ customerId: 'cust-1', name: 'X' });
    expect(result.getEmail()).toBe('a@b.com');
  });

  it('throws InvalidInputError when id missing', async () => {
    await expect(useCase.execute({ customerId: '' })).rejects.toThrow(
      InvalidInputError,
    );
  });

  it('throws CustomerNotFoundError when not found', async () => {
    (repo.findById as jest.Mock).mockResolvedValue(null);
    await expect(
      useCase.execute({ customerId: 'missing', name: 'X' }),
    ).rejects.toThrow(CustomerNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
