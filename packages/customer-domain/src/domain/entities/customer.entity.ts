import {
  CustomerStatus,
  CustomerStatusEnum,
  CustomerTier,
  CustomerTierEnum,
  CUSTOMER_TIERS,
} from '../constants';
import {
  CustomerAlreadyInactiveError,
  InvalidCustomerNameError,
  InvalidCustomerTierError,
} from '../exceptions';

const NAME_MAX_LENGTH = 120;
const COMPANY_MAX_LENGTH = 160;

/**
 * Customer Domain Entity
 *
 * A requester who raises tickets. Carries the support tier that feeds SLA
 * computation. Login identity is owned by auth, linked via userId.
 *
 * Invariants:
 * - email is immutable after creation (it is the auth link) — no setter.
 * - name is 1..120 chars; company (optional) is <= 160 chars.
 * - tier must be a member of CUSTOMER_TIERS.
 * - status uses soft-disable (ACTIVE -> INACTIVE). There is no hard delete.
 */
export class Customer {
  private constructor(
    private readonly customerId: string | null,
    private name: string,
    private readonly email: string,
    private userId: string | undefined,
    private company: string | undefined,
    private tier: CustomerTier,
    private customerStatus: CustomerStatus,
    private readonly dateCreated: string,
    private updatedAt: string,
  ) {}

  // ── Validation helpers ───────────────────────────────────────────────────
  private static validateName(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > NAME_MAX_LENGTH) {
      throw new InvalidCustomerNameError();
    }
  }

  private static validateCompany(company: string): void {
    if (company.length > COMPANY_MAX_LENGTH) {
      throw new InvalidCustomerNameError();
    }
  }

  private static validateTier(tier: string): asserts tier is CustomerTier {
    if (!CUSTOMER_TIERS.includes(tier as CustomerTier)) {
      throw new InvalidCustomerTierError(tier);
    }
  }

  /**
   * Factory: Create a new customer (not yet persisted).
   * status defaults to ACTIVE; tier defaults to FREE when not provided.
   */
  static create(props: {
    name: string;
    email: string;
    userId?: string;
    company?: string;
    tier?: string;
  }): Customer {
    Customer.validateName(props.name);
    if (props.company !== undefined) {
      Customer.validateCompany(props.company);
    }

    const tier = props.tier ?? CustomerTierEnum.FREE;
    Customer.validateTier(tier);

    const now = new Date().toISOString();
    return new Customer(
      null,
      props.name.trim(),
      props.email,
      props.userId,
      props.company,
      tier,
      CustomerStatusEnum.ACTIVE,
      now,
      now,
    );
  }

  /**
   * Factory: Reconstitute from persistence. Does NOT run create() validators.
   */
  static reconstitute(props: {
    customerId: string;
    name: string;
    email: string;
    userId?: string;
    company?: string;
    tier: CustomerTier;
    customerStatus: CustomerStatus;
    dateCreated: string;
    updatedAt: string;
  }): Customer {
    return new Customer(
      props.customerId,
      props.name,
      props.email,
      props.userId,
      props.company,
      props.tier,
      props.customerStatus,
      props.dateCreated,
      props.updatedAt,
    );
  }

  // ── Business methods ──────────────────────────────────────────────────────

  /**
   * Update mutable profile fields. email is immutable and cannot be changed.
   */
  updateProfile(props: { name?: string; company?: string; tier?: string }): void {
    if (props.name !== undefined) {
      Customer.validateName(props.name);
      this.name = props.name.trim();
    }
    if (props.company !== undefined) {
      Customer.validateCompany(props.company);
      this.company = props.company;
    }
    if (props.tier !== undefined) {
      Customer.validateTier(props.tier);
      this.tier = props.tier;
    }
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Soft-disable: ACTIVE -> INACTIVE. Throws if already INACTIVE.
   */
  deactivate(): void {
    if (this.customerStatus === CustomerStatusEnum.INACTIVE) {
      throw new CustomerAlreadyInactiveError();
    }
    this.customerStatus = CustomerStatusEnum.INACTIVE;
    this.updatedAt = new Date().toISOString();
  }

  // ── Getters ────────────────────────────────────────────────────────────
  getCustomerId(): string | null {
    return this.customerId;
  }

  getName(): string {
    return this.name;
  }

  getEmail(): string {
    return this.email;
  }

  getUserId(): string | undefined {
    return this.userId;
  }

  getCompany(): string | undefined {
    return this.company;
  }

  getTier(): CustomerTier {
    return this.tier;
  }

  getCustomerStatus(): CustomerStatus {
    return this.customerStatus;
  }

  getDateCreated(): string {
    return this.dateCreated;
  }

  getUpdatedAt(): string {
    return this.updatedAt;
  }
}
