import { DeactivateCustomerUseCase } from './deactivate-customer.use-case';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import { CustomerStatusEnum } from '../../../domain/constants';
import {
  CustomerNotFoundError,
  InvalidInputError,
} from '../../exceptions';
import { CustomerAlreadyInactiveError } from '../../../domain/exceptions';

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

describe('DeactivateCustomerUseCase', () => {
  let repo: ICustomerRepository;
  let useCase: DeactivateCustomerUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createMockRepository();
    useCase = new DeactivateCustomerUseCase(repo);
  });

  it('deactivates an ACTIVE customer', async () => {
    const customer = Customer.create({ name: 'A', email: 'a@b.com' });
    (repo.findById as jest.Mock).mockResolvedValue(customer);
    (repo.save as jest.Mock).mockImplementation((c) => Promise.resolve(c));

    const result = await useCase.execute({ customerId: 'cust-1' });
    expect(result.getCustomerStatus()).toBe(CustomerStatusEnum.INACTIVE);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('throws InvalidInputError when id missing', async () => {
    await expect(useCase.execute({ customerId: '' })).rejects.toThrow(
      InvalidInputError,
    );
  });

  it('throws CustomerNotFoundError when not found', async () => {
    (repo.findById as jest.Mock).mockResolvedValue(null);
    await expect(
      useCase.execute({ customerId: 'missing' }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it('throws CustomerAlreadyInactiveError when already inactive', async () => {
    const customer = Customer.reconstitute({
      customerId: 'cust-1',
      name: 'A',
      email: 'a@b.com',
      tier: 'FREE',
      customerStatus: CustomerStatusEnum.INACTIVE,
      dateCreated: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    (repo.findById as jest.Mock).mockResolvedValue(customer);

    await expect(
      useCase.execute({ customerId: 'cust-1' }),
    ).rejects.toThrow(CustomerAlreadyInactiveError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
