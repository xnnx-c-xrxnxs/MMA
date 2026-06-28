import { Table } from 'dynamodb-onetable';
import type { Dynamo } from 'dynamodb-onetable/Dynamo';

export interface TableConfig {
  client: Dynamo;
  name: string;
  schema: any;
}

export function createTable(config: TableConfig): Table {
  return new Table({
    client: config.client,
    name: config.name,
    partial: true,
    schema: config.schema,
  });
}
