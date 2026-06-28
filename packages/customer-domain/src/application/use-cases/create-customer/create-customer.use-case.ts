import { IUseCase } from '@mma/common';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import { CustomerAlreadyExistsError } from '../../exceptions';

export interface CreateCustomerInput {
  name: string;
  email: string;
  userId?: string;
  company?: string;
  tier?: string;
}

export class CreateCustomerUseCase
  implements IUseCase<CreateCustomerInput, Customer>
{
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(input: CreateCustomerInput): Promise<Customer> {
    // Enforce email uniqueness (email is the immutable auth link).
    const existing = await this.customerRepository.findByEmail(input.email);
    if (existing) {
      throw new CustomerAlreadyExistsError(input.email);
    }

    const customer = Customer.create({
      name: input.name,
      email: input.email,
      userId: input.userId,
      company: input.company,
      tier: input.tier,
    });
    return await this.customerRepository.save(customer);
  }
}
