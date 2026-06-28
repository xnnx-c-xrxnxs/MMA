import { Table } from 'dynamodb-onetable';
import type { Dynamo } from 'dynamodb-onetable/Dynamo';
import {
  createDynamoLocalClient,
  createAWSClient,
  createTable,
} from '@old-st/dynamodb-onetable';

export class DynamoDBConfig {
  private static client: Dynamo;
  private static tables = new Map<string, Table>();

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
