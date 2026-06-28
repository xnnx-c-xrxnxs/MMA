import { Table } from 'dynamodb-onetable';
import type { Dynamo } from 'dynamodb-onetable/Dynamo';
import {
  createDynamoLocalClient,
  createAWSClient,
  createTable,
} from '@old-st/dynamodb-onetable';

/**
 * DynamoDB Configuration
 *
 * Separates two concerns:
 *   1. Client — single shared Dynamo connection/pool for the process
 *   2. Tables — per-schema Table instances, keyed by table name
 *
 * This design supports multiple tables in one service:
 *   DynamoDBConfig.getTable(process.env.USERS_TABLE, UserSchema)
 *   DynamoDBConfig.getTable(process.env.ORDERS_TABLE, OrderSchema)
 */
export class DynamoDBConfig {
  private static client: Dynamo;
  private static tables = new Map<string, Table>();

  /**
   * Returns the shared DynamoDB client for this process.
   * Creates it once; reuses on every subsequent call.
   */
  static getClient(): Dynamo {
    if (!this.client) {
      const isLocal =
        process.env.STAGE === 'local' ||
        !!process.env.DYNAMODB_ENDPOINT;

      this.client = isLocal
        ? createDynamoLocalClient()
        : createAWSClient(process.env.AWS_REGION || 'us-east-1');
    }
    return this.client;
  }

  /**
   * Returns (or lazily creates) a Table instance for the given name + schema.
   * Multiple schemas share the single underlying client.
   *
   * @param name   - DynamoDB table name (typically from process.env)
   * @param schema - OneTable schema object for this table
   */
  static getTable(name: string, schema: object): Table {
    if (!this.tables.has(name)) {
      this.tables.set(
        name,
        createTable({ client: this.getClient(), name, schema }),
      );
    }
    const table = this.tables.get(name);
    if (!table) {
      throw new Error(`Failed to initialise DynamoDB table: ${name}`);
    }
    return table;
  }
}
