import { IUseCase, IPaginatedResponse } from '@mma/common';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';
import { Customer } from '../../../domain/entities';
import { CustomerStatus } from '../../../domain/constants';
import { InvalidInputError } from '../../exceptions';

export interface ListCustomersByStatusInput {
  status: CustomerStatus;
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class ListCustomersByStatusUseCase
  implements IUseCase<ListCustomersByStatusInput, IPaginatedResponse<Customer>>
{
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(
    input: ListCustomersByStatusInput,
  ): Promise<IPaginatedResponse<Customer>> {
    if (!input.status) {
      throw new InvalidInputError('Status is required');
    }
    return await this.customerRepository.listByStatus(
      input.status,
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer,
    );
  }
}
