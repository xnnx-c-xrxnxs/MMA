import { Table } from 'dynamodb-onetable';
import { IPaginatedResponse } from '@old-st/common';
import {
  pageRecordHandler,
  createDynamoDbOptionWithPKSKIndex,
} from '@old-st/dynamodb-onetable';
import {
  IUserRepository,
} from '../../application/interfaces/user-repository.interface';
import { UserRole, UserStatus } from '../../domain/constants';
import { User } from '../../domain/entities';
import { UserDataType } from '../schemas/UserSchema';

/**
 * Local structural interface for the dynamodb-onetable Model instance.
 * Typed for read returns (UserDataType) with flexible object inputs,
 * avoiding dynamodb-onetable's complex EntityParametersForCreate mapped types.
 */
interface IUserModel {
  create(properties: object): Promise<UserDataType>;
  upsert(properties: object): Promise<UserDataType>;
  get(properties: object, options?: object): Promise<UserDataType | undefined>;
  find(properties: object, options?: object): Promise<UserDataType[]>;
}

/**
 * DynamoDB User Repository Implementation
 * Handles all user CRUD operations using dynamodb-onetable
 */
export class DynamoUserRepository implements IUserRepository {
  private readonly UserModel: IUserModel;

  constructor(private readonly table: Table) {
    this.UserModel = this.table.getModel('User') as unknown as IUserModel;
  }

  /**
   * Save a user entity (create or update)
   */
  async save(user: User): Promise<User> {
    const data = this.toPersistence(user);

    if (user.getUserId()) {
      // Update existing user - use upsert to ensure full entity is saved
      const updated = await this.UserModel.upsert(data);
      return this.toDomain(updated);
    } else {
      // Create new user
      const created = await this.UserModel.create(data);
      return this.toDomain(created);
    }
  }

  /**
   * Find user by ID (Primary Key)
   */
  async findById(userId: string): Promise<User | null> {
    const result = await this.UserModel.get({ userId });
    return result ? this.toDomain(result) : null;
  }

  /**
   * Find user by email (GSI4: GSI4PK = 'USER#{email}')
   */
  async findByEmail(email: string): Promise<User | null> {
    const results = await this.UserModel.find(
      { email },
      {
        index: 'GSI4',
        limit: 1,
      }
    );

    return results.length > 0 ? this.toDomain(results[0]) : null;
  }

  /**
   * List users by status (GSI5: GSI5PK = 'USER#{userStatus}', GSI5SK = email)
   * Uses DynamoDB OneTable native cursor-based pagination
   */
  async listByStatus(
    userStatus: UserStatus,
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<User>> {
    // Determine which cursor to use based on direction
    const cursorPointer = direction === 'prev' ? prevCursorPointer : nextCursorPointer;

    // Build DynamoDB query options
    const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
      limit,
      'GSI5',
      direction,
      cursorPointer || ''
    );

    // Query DynamoDB (raw records so cursor fields GSI5PK/GSI5SK/PK/SK are accessible)
    const results = await this.UserModel.find(
      { userStatus },
      dynamoDbOptions
    );

    // Paginate on raw records, then map to domain entities
    const paginatedResult = pageRecordHandler<UserDataType>(
      [...results],
      limit,
      direction,
      'GSI5PK',
      'GSI5SK',
      'PK',
      'SK',
      nextCursorPointer || '',
      prevCursorPointer || ''
    );

    return {
      data: paginatedResult.data.map((item) => this.toDomain(item)),
      nextCursorPointer: paginatedResult.nextCursorPointer,
      prevCursorPointer: paginatedResult.prevCursorPointer,
    };
  }

  /**
   * List users by role and status (GSI1: GSI1PK = 'USER#{userRole}#{userStatus}', GSI1SK = email)
   * Uses cursor-based pagination with pageRecordHandler utility
   */
  async listByRoleAndStatus(
    userRole: UserRole,
    userStatus: UserStatus,
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string
  ): Promise<IPaginatedResponse<User>> {
    // Determine which cursor to use based on direction
    const cursorPointer = direction === 'prev' ? prevCursorPointer : nextCursorPointer;

    // Build DynamoDB query options - pass empty string if no cursor
    const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
      limit,
      'GSI1',
      direction,
      cursorPointer || ''
    );

    // Query DynamoDB (raw records so cursor fields GSI1PK/GSI1SK/PK/SK are accessible)
    const results = await this.UserModel.find(
      { userRole, userStatus },
      dynamoDbOptions
    );

    // Paginate on raw records, then map to domain entities
    const paginatedResult = pageRecordHandler<UserDataType>(
      [...results],
      limit,
      direction,
      'GSI1PK',
      'GSI1SK',
      'PK',
      'SK',
      nextCursorPointer || '',
      prevCursorPointer || ''
    );

    return {
      data: paginatedResult.data.map((item) => this.toDomain(item)),
      nextCursorPointer: paginatedResult.nextCursorPointer,
      prevCursorPointer: paginatedResult.prevCursorPointer,
    };
  }

  /**
   * Private: Convert DynamoDB record to domain entity
   */
  private toDomain(raw: UserDataType): User {
    // dynamodb-onetable adds createdAt/updatedAt when timestamps: true.
    // With isoDates: true these are returned as Date objects — convert to ISO strings.
    // Guard against undefined: records created before timestamps were enabled (or during
    // local table resets) may lack these fields. Fall back to dateCreated so the domain
    // entity and Zod datetime() validation never see undefined.
    const record = raw as UserDataType & { createdAt?: Date | string; updatedAt?: Date | string };

    const toIsoString = (value: Date | string | undefined, fallback: string): string => {
      if (!value) return fallback;
      return value instanceof Date ? value.toISOString() : value;
    };

    const dateCreated = record.dateCreated ?? new Date().toISOString();

    const userId = record.userId;
    if (!userId) throw new Error('DynamoDB record missing userId');

    return User.reconstitute({
      userId,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      emailVerified: record.emailVerified ?? false,
      userRole: record.userRole as UserRole,
      userStatus: record.userStatus as UserStatus,
      dateCreated,
      data: record.data || {},
      updatedAt: toIsoString(record.updatedAt, dateCreated),
    });
  }

  /**
   * Private: Convert domain entity to database record
   */
  private toPersistence(user: User): Partial<UserDataType> {
    const userId = user.getUserId();
    
    return {
      ...(userId && { userId }),
      email: user.getEmail(),
      firstName: user.getFirstName(),
      lastName: user.getLastName(),
      emailVerified: user.isEmailVerified(),
      userRole: user.getUserRole(),
      userStatus: user.getUserStatus(),
      dateCreated: user.getDateCreated(),
      data: user.getData(),
    };
  }
}
