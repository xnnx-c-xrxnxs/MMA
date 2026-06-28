import { IUseCase } from '@mma/common';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import { InvalidInputError, CustomerNotFoundError } from '../../exceptions';

export interface UpdateCustomerInput {
  customerId: string;
  name?: string;
  company?: string;
  tier?: string;
}

export class UpdateCustomerUseCase
  implements IUseCase<UpdateCustomerInput, Customer>
{
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(input: UpdateCustomerInput): Promise<Customer> {
    if (!input.customerId) {
      throw new InvalidInputError('Customer ID is required');
    }
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new CustomerNotFoundError(input.customerId);
    }
    // email is immutable — only name/company/tier may change.
    customer.updateProfile({
      name: input.name,
      company: input.company,
      tier: input.tier,
    });
    return await this.customerRepository.save(customer);
  }
}
