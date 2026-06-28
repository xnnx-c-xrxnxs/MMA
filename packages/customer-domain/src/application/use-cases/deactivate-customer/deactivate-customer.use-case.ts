import { IUseCase } from '@mma/common';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import { InvalidInputError, CustomerNotFoundError } from '../../exceptions';

export interface DeactivateCustomerInput {
  customerId: string;
}

export class DeactivateCustomerUseCase
  implements IUseCase<DeactivateCustomerInput, Customer>
{
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(input: DeactivateCustomerInput): Promise<Customer> {
    if (!input.customerId) {
      throw new InvalidInputError('Customer ID is required');
    }
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new CustomerNotFoundError(input.customerId);
    }
    customer.deactivate();
    return await this.customerRepository.save(customer);
  }
}
