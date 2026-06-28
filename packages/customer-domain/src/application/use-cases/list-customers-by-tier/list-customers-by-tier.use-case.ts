import { IUseCase, IPaginatedResponse } from '@mma/common';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import { CustomerTier } from '../../../domain/constants';
import { InvalidInputError } from '../../exceptions';

export interface ListCustomersByTierInput {
  tier: CustomerTier;
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class ListCustomersByTierUseCase
  implements IUseCase<ListCustomersByTierInput, IPaginatedResponse<Customer>>
{
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(
    input: ListCustomersByTierInput,
  ): Promise<IPaginatedResponse<Customer>> {
    if (!input.tier) {
      throw new InvalidInputError('Tier is required');
    }
    return await this.customerRepository.listByTier(
      input.tier,
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer,
    );
  }
}
