import { createTree } from '@nx/devkit/testing';
import { addLocalstackQueue, addLocalstackTable } from './update-localstack-setup';

const seedScript = () => `import { foo } from 'bar';

interface TableConfig { tableName: string }

const TABLE_CONFIGS: TableConfig[] = [
  {
    tableName: process.env.USERS_DYNAMODB_TABLE_NAME || 'USERS',
    description: 'user-domain',
    primaryHashKey: 'PK',
    primarySortKey: 'SK',
    attributeDefinitions: [
      { name: 'PK', type: 'S' as const },
    ],
    gsis: [],
  },
];

console.log(TABLE_CONFIGS);
`;

describe('addLocalstackTable', () => {
  it('appends a new TableConfig before the closing bracket', () => {
    const tree = createTree();
    tree.write('scripts/setup-localstack.ts', seedScript());
    const wrote = addLocalstackTable(tree, {
      domainPascal: 'Shipping',
      domainConstant: 'SHIPPINGS',
      tableNameEnvVar: 'SHIPPINGS_DYNAMODB_TABLE_NAME',
      schemaName: 'ShipmentSchema',
      domainKebab: 'shipping',
      gsis: [
        { indexName: 'GSI1', hashKeyTemplate: 'SHIPPING#${status}', sortKeyTemplate: '${trackingNumber}', purpose: 'list by status' },
      ],
    });
    expect(wrote).toBe(true);
    const updated = tree.read('scripts/setup-localstack.ts', 'utf-8') ?? '';
    expect(updated).toContain('SHIPPINGS_DYNAMODB_TABLE_NAME');
    expect(updated).toContain("indexName: 'GSI1'");
    expect(updated).toContain('USERS_DYNAMODB_TABLE_NAME');
    // Original closing structure preserved
    expect(updated).toMatch(/];\s*\n\s*console\.log/);
  });

  it('is idempotent', () => {
    const tree = createTree();
    tree.write('scripts/setup-localstack.ts', seedScript());
    addLocalstackTable(tree, {
      domainPascal: 'Shipping',
      domainConstant: 'SHIPPINGS',
      tableNameEnvVar: 'SHIPPINGS_DYNAMODB_TABLE_NAME',
      schemaName: 'ShipmentSchema',
      domainKebab: 'shipping',
      gsis: [],
    });
    const wrote = addLocalstackTable(tree, {
      domainPascal: 'Shipping',
      domainConstant: 'SHIPPINGS',
      tableNameEnvVar: 'SHIPPINGS_DYNAMODB_TABLE_NAME',
      schemaName: 'ShipmentSchema',
      domainKebab: 'shipping',
      gsis: [],
    });
    expect(wrote).toBe(false);
  });
});

const seedQueueScript = () => `import { foo } from 'bar';

interface QueueConfig { queueNameEnvVar: string; queueNameDefault: string; description: string; fifo?: boolean }

const QUEUE_CONFIGS: QueueConfig[] = [
  {
    queueNameEnvVar: 'USERS_SQS_QUEUE_NAME',
    queueNameDefault: 'users-events',
    description: 'User events',
  },
];

console.log(QUEUE_CONFIGS);
`;

describe('addLocalstackQueue', () => {
  it('appends a new QueueConfig before the closing bracket', () => {
    const tree = createTree();
    tree.write('scripts/setup-localstack.ts', seedQueueScript());
    const wrote = addLocalstackQueue(tree, {
      queueNameEnvVar: 'NOTIFICATIONS_SQS_QUEUE_NAME',
      queueNameDefault: 'notifications-events',
      description: 'Notification events',
    });
    expect(wrote).toBe(true);
    const updated = tree.read('scripts/setup-localstack.ts', 'utf-8') ?? '';
    expect(updated).toContain('NOTIFICATIONS_SQS_QUEUE_NAME');
    expect(updated).toContain("queueNameDefault: 'notifications-events'");
    expect(updated).toContain('USERS_SQS_QUEUE_NAME');
    expect(updated).toMatch(/];\s*\n\s*console\.log/);
  });

  it('emits fifo: true when requested', () => {
    const tree = createTree();
    tree.write('scripts/setup-localstack.ts', seedQueueScript());
    addLocalstackQueue(tree, {
      queueNameEnvVar: 'PAYMENTS_SQS_QUEUE_NAME',
      queueNameDefault: 'payments-events.fifo',
      description: 'Payment events',
      fifo: true,
    });
    const updated = tree.read('scripts/setup-localstack.ts', 'utf-8') ?? '';
    expect(updated).toContain('fifo: true');
  });

  it('is idempotent', () => {
    const tree = createTree();
    tree.write('scripts/setup-localstack.ts', seedQueueScript());
    addLocalstackQueue(tree, {
      queueNameEnvVar: 'NOTIFICATIONS_SQS_QUEUE_NAME',
      queueNameDefault: 'notifications-events',
      description: 'Notification events',
    });
    const wrote = addLocalstackQueue(tree, {
      queueNameEnvVar: 'NOTIFICATIONS_SQS_QUEUE_NAME',
      queueNameDefault: 'notifications-events',
      description: 'duplicate',
    });
    expect(wrote).toBe(false);
  });
});
