import { IPaginatedResponse } from '@mma/common';
import { CustomerStatus, CustomerTier } from '../../domain/constants';
import { Customer } from '../../domain/entities';

export abstract class ICustomerRepository {
  abstract save(customer: Customer): Promise<Customer>;

  abstract findById(customerId: string): Promise<Customer | null>;

  /** Resolve a customer by their linked auth userId (GSI3, unique). */
  abstract findByUserId(userId: string): Promise<Customer | null>;

  /** Resolve a customer by email (GSI4, unique) — used for uniqueness checks. */
  abstract findByEmail(email: string): Promise<Customer | null>;

  /** List customers by status with cursor-based pagination (GSI1). */
  abstract listByStatus(
    customerStatus: CustomerStatus,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string,
  ): Promise<IPaginatedResponse<Customer>>;

  /** List customers by tier with cursor-based pagination (GSI2). */
  abstract listByTier(
    tier: CustomerTier,
    limit?: number,
    direction?: string,
    nextCursorPointer?: string,
    prevCursorPointer?: string,
  ): Promise<IPaginatedResponse<Customer>>;
}
