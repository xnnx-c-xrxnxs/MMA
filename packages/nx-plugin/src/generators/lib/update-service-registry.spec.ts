import { createTree } from '@nx/devkit/testing';
import {
  addApiServiceEntry,
  addDynamoTableEntry,
  addEventHandlerServiceEntry,
  addPublicRoutesForService,
  addSqsQueueEntry,
} from './update-service-registry';

const seed = () => {
  const tree = createTree();
  tree.write(
    '.github/service-registry.json',
    JSON.stringify({
      apiServices: [{ name: 'user-api-service', distPath: 'x', domain: 'user', type: 'api', handler: 'run.sh', memorySize: 256, timeout: 30, envVars: [] }],
      eventHandlerServices: [],
      infrastructure: { dynamodbTables: [], sqsQueues: [] },
      gatewayAuth: { enabled: true, publicRoutes: [] },
    }, null, 2),
  );
  return tree;
};

describe('update-service-registry', () => {
  it('addApiServiceEntry adds a new service', () => {
    const tree = seed();
    addApiServiceEntry(tree, {
      name: 'shipping-api-service',
      distPath: 'dist/apps/shipping/shipping-api-service/main.js',
      domain: 'shipping',
      type: 'api',
      handler: 'run.sh',
      memorySize: 512,
      timeout: 30,
      envVars: ['SHIPPINGS_DYNAMODB_TABLE_NAME'],
    });
    const json = JSON.parse(tree.read('.github/service-registry.json', 'utf-8') ?? '{}');
    expect(json.apiServices).toHaveLength(2);
    expect(json.apiServices[1].name).toBe('shipping-api-service');
  });

  it('addApiServiceEntry throws on duplicate name', () => {
    const tree = seed();
    expect(() =>
      addApiServiceEntry(tree, {
        name: 'user-api-service',
        distPath: 'x',
        domain: 'user',
        type: 'api',
        handler: 'run.sh',
        memorySize: 256,
        timeout: 30,
        envVars: [],
      }),
    ).toThrow(/already registered/);
  });

  it('addDynamoTableEntry adds a new table and its GSIs', () => {
    const tree = seed();
    addDynamoTableEntry(tree, {
      envVar: 'SHIPPINGS_DYNAMODB_TABLE_NAME',
      domain: 'shipping',
      gsis: [{ indexName: 'GSI1', hashKey: 'GSI1PK', hashKeyType: 'S', sortKey: 'GSI1SK', sortKeyType: 'S' }],
    });
    const json = JSON.parse(tree.read('.github/service-registry.json', 'utf-8') ?? '{}');
    expect(json.infrastructure.dynamodbTables).toHaveLength(1);
  });

  it('addPublicRoutesForService seeds health + 3 swagger routes idempotently', () => {
    const tree = seed();
    addPublicRoutesForService(tree, 'shipping-api-service');
    // Second call must not duplicate.
    addPublicRoutesForService(tree, 'shipping-api-service');
    const json = JSON.parse(tree.read('.github/service-registry.json', 'utf-8') ?? '{}');
    expect(json.gatewayAuth.publicRoutes).toEqual([
      { service: 'shipping-api-service', method: 'GET', path: '/api/health' },
      { service: 'shipping-api-service', method: 'GET', path: '/api/swagger' },
      { service: 'shipping-api-service', method: 'GET', path: '/api/swagger-json' },
      { service: 'shipping-api-service', method: 'GET', path: '/api/swagger/{proxy+}' },
    ]);
  });

  it('addEventHandlerServiceEntry adds a new worker entry', () => {
    const tree = seed();
    addEventHandlerServiceEntry(tree, {
      name: 'notification-event-handler-service',
      distPath: 'dist/apps/notification/notification-event-handler-service/main.js',
      domain: 'notification',
      type: 'worker',
      handler: 'main.handler',
      memorySize: 512,
      timeout: 30,
      sqsQueueRef: 'NOTIFICATIONS_SQS_QUEUE_NAME',
      envVars: ['NOTIFICATIONS_DYNAMODB_TABLE_NAME', 'NOTIFICATIONS_SQS_QUEUE_URL'],
    });
    const json = JSON.parse(tree.read('.github/service-registry.json', 'utf-8') ?? '{}');
    expect(json.eventHandlerServices).toHaveLength(1);
    expect(json.eventHandlerServices[0].name).toBe('notification-event-handler-service');
    expect(json.eventHandlerServices[0].sqsQueueRef).toBe('NOTIFICATIONS_SQS_QUEUE_NAME');
  });

  it('addEventHandlerServiceEntry throws on duplicate name', () => {
    const tree = seed();
    addEventHandlerServiceEntry(tree, {
      name: 'notification-event-handler-service',
      distPath: 'x',
      domain: 'notification',
      type: 'worker',
      handler: 'main.handler',
      memorySize: 512,
      timeout: 30,
      sqsQueueRef: 'NOTIFICATIONS_SQS_QUEUE_NAME',
      envVars: [],
    });
    expect(() =>
      addEventHandlerServiceEntry(tree, {
        name: 'notification-event-handler-service',
        distPath: 'x',
        domain: 'notification',
        type: 'worker',
        handler: 'main.handler',
        memorySize: 512,
        timeout: 30,
        sqsQueueRef: 'NOTIFICATIONS_SQS_QUEUE_NAME',
        envVars: [],
      }),
    ).toThrow(/already registered/);
  });

  it('addSqsQueueEntry adds a new queue and is idempotent', () => {
    const tree = seed();
    addSqsQueueEntry(tree, {
      envVar: 'NOTIFICATIONS_SQS_QUEUE_NAME',
      domain: 'notification',
      fifo: false,
      description: 'Notification events',
    });
    addSqsQueueEntry(tree, {
      envVar: 'NOTIFICATIONS_SQS_QUEUE_NAME',
      domain: 'notification',
      fifo: false,
      description: 'duplicate — should be ignored',
    });
    const json = JSON.parse(tree.read('.github/service-registry.json', 'utf-8') ?? '{}');
    expect(json.infrastructure.sqsQueues).toHaveLength(1);
    expect(json.infrastructure.sqsQueues[0].description).toBe('Notification events');
  });
});
