import { IUseCase } from '@mma/common';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import { InvalidInputError, CustomerNotFoundError } from '../../exceptions';

export class GetCustomerByUserIdUseCase implements IUseCase<string, Customer> {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(userId: string): Promise<Customer> {
    if (!userId) {
      throw new InvalidInputError('User ID is required');
    }
    const customer = await this.customerRepository.findByUserId(userId);
    if (!customer) {
      throw new CustomerNotFoundError(userId);
    }
    return customer;
  }
}
