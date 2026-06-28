import { IUseCase } from '@mma/common';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import { InvalidInputError, CustomerNotFoundError } from '../../exceptions';

export class GetCustomerUseCase implements IUseCase<string, Customer> {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(customerId: string): Promise<Customer> {
    if (!customerId) {
      throw new InvalidInputError('Customer ID is required');
    }
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }
    return customer;
  }
}
