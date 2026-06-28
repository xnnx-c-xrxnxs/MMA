import { createTree } from '@nx/devkit/testing';
import eventHandlerGenerator from './generator';
import { buildEventTypeNames } from './templates/domain-files';

const seedWorkspace = () => {
  const tree = createTree();
  tree.write(
    '.github/service-registry.json',
    JSON.stringify(
      {
        apiServices: [],
        eventHandlerServices: [],
        webapp: { envVars: [] },
        infrastructure: {
          dynamodbTables: [],
          sqsQueues: [],
          rds: [],
          s3Buckets: [],
        },
        deployTasks: [],
        gatewayAuth: { enabled: true, publicRoutes: [] },
      },
      null,
      2,
    ),
  );
  tree.write(
    '.env.local.example',
    '# Workspace defaults\nSTAGE=local\nDEFAULT_REGION=eu-west-2\n',
  );
  tree.write(
    '.vscode/tasks.json',
    JSON.stringify(
      {
        version: '2.0.0',
        tasks: [
          {
            label: 'Services: Start All',
            dependsOn: [],
            dependsOrder: 'parallel',
            runOptions: { runOn: 'default' },
            problemMatcher: [],
          },
        ],
      },
      null,
      2,
    ),
  );
  tree.write(
    'scripts/setup-localstack.ts',
    `interface QueueConfig { queueNameEnvVar: string; queueNameDefault: string; description: string; fifo?: boolean }

const QUEUE_CONFIGS: QueueConfig[] = [
  {
    queueNameEnvVar: 'USERS_SQS_QUEUE_NAME',
    queueNameDefault: 'users-events',
    description: 'User events',
  },
];

console.log(QUEUE_CONFIGS);
`,
  );
  return tree;
};

describe('buildEventTypeNames', () => {
  it('parses a CONSTANT_CASE event type into all naming variants', () => {
    const names = buildEventTypeNames('USER_DELETED');
    expect(names.constant).toBe('USER_DELETED');
    expect(names.kebab).toBe('user-deleted');
    expect(names.pascal).toBe('UserDeleted');
    expect(names.camel).toBe('userDeleted');
    expect(names.fileName).toBe('user-deleted.handler.ts');
    expect(names.className).toBe('UserDeletedHandler');
  });

  it('rejects non-CONSTANT_CASE inputs', () => {
    expect(() => buildEventTypeNames('userDeleted')).toThrow();
    expect(() => buildEventTypeNames('user-deleted')).toThrow();
    expect(() => buildEventTypeNames('1USER')).toThrow();
  });
});

describe('event-handler generator', () => {
  it('rejects invalid domain names', async () => {
    const tree = seedWorkspace();
    await expect(
      eventHandlerGenerator(tree, { domain: 'Notification', eventTypes: 'NOTIFICATION_SENT' }),
    ).rejects.toThrow();
  });

  it('rejects when crossDomain=true without sourceDomain', async () => {
    const tree = seedWorkspace();
    await expect(
      eventHandlerGenerator(tree, {
        domain: 'order',
        eventTypes: 'PRODUCT_DEACTIVATED',
        crossDomain: true,
      }),
    ).rejects.toThrow(/sourceDomain/);
  });

  it('throws when no event types are supplied', async () => {
    const tree = seedWorkspace();
    await expect(
      eventHandlerGenerator(tree, { domain: 'notification', eventTypes: '' }),
    ).rejects.toThrow();
  });

  it('throws when service folder already exists', async () => {
    const tree = seedWorkspace();
    tree.write(
      'apps/notification/notification-event-handler-service/project.json',
      '{}',
    );
    await expect(
      eventHandlerGenerator(tree, { domain: 'notification', eventTypes: 'X_OCCURRED' }),
    ).rejects.toThrow(/already exists/);
  });

  it('generates the full event-handler service at the expected paths', async () => {
    const tree = seedWorkspace();
    await eventHandlerGenerator(tree, {
      domain: 'notification',
      eventTypes: 'NOTIFICATION_SENT,NOTIFICATION_FAILED',
    });

    const root = 'apps/notification/notification-event-handler-service';
    expect(tree.exists(`${root}/project.json`)).toBe(true);
    expect(tree.exists(`${root}/tsconfig.json`)).toBe(true);
    expect(tree.exists(`${root}/tsconfig.app.json`)).toBe(true);
    expect(tree.exists(`${root}/tsconfig.spec.json`)).toBe(true);
    expect(tree.exists(`${root}/jest.config.cts`)).toBe(true);
    expect(tree.exists(`${root}/webpack.config.js`)).toBe(true);
    expect(tree.exists(`${root}/src/main.ts`)).toBe(true);
    expect(tree.exists(`${root}/src/app/app.module.ts`)).toBe(true);
    expect(
      tree.exists(`${root}/src/modules/notification.module.ts`),
    ).toBe(true);
    expect(
      tree.exists(`${root}/src/application/interfaces/normalized-sqs-record.interface.ts`),
    ).toBe(true);
    expect(
      tree.exists(`${root}/src/application/interfaces/event-handler.interface.ts`),
    ).toBe(true);
    expect(
      tree.exists(
        `${root}/src/application/services/notification-event-handler.service.ts`,
      ),
    ).toBe(true);
    expect(
      tree.exists(
        `${root}/src/application/services/handlers/notification-sent.handler.ts`,
      ),
    ).toBe(true);
    expect(
      tree.exists(
        `${root}/src/application/services/handlers/notification-failed.handler.ts`,
      ),
    ).toBe(true);
    expect(
      tree.exists(`${root}/src/application/services/handlers/index.ts`),
    ).toBe(true);
    expect(
      tree.exists(`${root}/src/infrastructure/sqs/sqs-local.service.ts`),
    ).toBe(true);
  });

  it('generates a same-domain dispatcher with own contracts import', async () => {
    const tree = seedWorkspace();
    await eventHandlerGenerator(tree, {
      domain: 'notification',
      eventTypes: 'NOTIFICATION_SENT',
    });

    const dispatcher = tree.read(
      'apps/notification/notification-event-handler-service/src/application/services/notification-event-handler.service.ts',
      'utf-8',
    ) ?? '';
    expect(dispatcher).toContain("from '@mma/contracts/notification'");
    expect(dispatcher).toContain('notificationDomainEventSchema');
    expect(dispatcher).toContain('NotificationEventTypeEnum.NOTIFICATION_SENT');
    expect(dispatcher).toContain('class NotificationEventHandlerService');

    const handler = tree.read(
      'apps/notification/notification-event-handler-service/src/application/services/handlers/notification-sent.handler.ts',
      'utf-8',
    ) ?? '';
    // Same-domain handler imports payload from the domain package directly.
    expect(handler).toContain("from '@mma/notification-domain'");
    expect(handler).toContain('NotificationSentPayload');
    expect(handler).toContain('class NotificationSentHandler');
  });

  it('generates a cross-domain dispatcher importing from the source domain contracts', async () => {
    const tree = seedWorkspace();
    await eventHandlerGenerator(tree, {
      domain: 'order',
      eventTypes: 'PRODUCT_DEACTIVATED,PRODUCT_PRICE_CHANGED',
      crossDomain: true,
      sourceDomain: 'product',
    });

    const dispatcher = tree.read(
      'apps/order/order-event-handler-service/src/application/services/order-event-handler.service.ts',
      'utf-8',
    ) ?? '';
    expect(dispatcher).toContain("from '@mma/contracts/product'");
    expect(dispatcher).toContain('productDomainEventSchema');
    expect(dispatcher).toContain('ProductEventTypeEnum.PRODUCT_DEACTIVATED');
    expect(dispatcher).toContain('ProductEventTypeEnum.PRODUCT_PRICE_CHANGED');

    const handler = tree.read(
      'apps/order/order-event-handler-service/src/application/services/handlers/product-deactivated.handler.ts',
      'utf-8',
    ) ?? '';
    // Cross-domain handler must NOT import the source-domain package.
    expect(handler).not.toContain("'@mma/product-domain'");
    expect(handler).toContain("from '@mma/contracts/product'");
    expect(handler).toContain('Extract<ProductDomainEvent');
    expect(handler).toContain("eventType: 'PRODUCT_DEACTIVATED'");
  });

  it('updates service-registry.json with worker entry and queue', async () => {
    const tree = seedWorkspace();
    await eventHandlerGenerator(tree, {
      domain: 'notification',
      eventTypes: 'NOTIFICATION_SENT',
    });
    const registry = JSON.parse(
      tree.read('.github/service-registry.json', 'utf-8') ?? '{}',
    );
    expect(registry.eventHandlerServices).toHaveLength(1);
    expect(registry.eventHandlerServices[0]).toMatchObject({
      name: 'notification-event-handler-service',
      type: 'worker',
      handler: 'main.handler',
      sqsQueueRef: 'NOTIFICATIONS_SQS_QUEUE_NAME',
    });
    expect(registry.eventHandlerServices[0].envVars).toContain(
      'NOTIFICATIONS_SQS_QUEUE_URL',
    );
    expect(registry.infrastructure.sqsQueues).toHaveLength(1);
    expect(registry.infrastructure.sqsQueues[0].envVar).toBe(
      'NOTIFICATIONS_SQS_QUEUE_NAME',
    );
  });

  it('appends env vars and registers the localstack queue', async () => {
    const tree = seedWorkspace();
    await eventHandlerGenerator(tree, {
      domain: 'notification',
      eventTypes: 'NOTIFICATION_SENT',
    });
    const env = tree.read('.env.local.example', 'utf-8') ?? '';
    expect(env).toContain('# --- notification-event-handler-service ---');
    expect(env).toContain('NOTIFICATIONS_SQS_QUEUE_URL=');
    expect(env).toContain('NOTIFICATIONS_SQS_QUEUE_NAME=notification-events');

    const localstack = tree.read('scripts/setup-localstack.ts', 'utf-8') ?? '';
    expect(localstack).toContain("queueNameEnvVar: 'NOTIFICATIONS_SQS_QUEUE_NAME'");
    expect(localstack).toContain("queueNameDefault: 'notification-events'");
  });

  it('registers the serve task and adds it to Services: Start All', async () => {
    const tree = seedWorkspace();
    await eventHandlerGenerator(tree, {
      domain: 'notification',
      eventTypes: 'NOTIFICATION_SENT',
    });
    const tasks = JSON.parse(tree.read('.vscode/tasks.json', 'utf-8') ?? '{}');
    const labels = (tasks.tasks as Array<{ label: string }>).map((t) => t.label);
    expect(labels).toContain('Service: Serve notification-event-handler-service');
    const compound = (tasks.tasks as Array<{ label: string; dependsOn?: string[] }>).find(
      (t) => t.label === 'Services: Start All',
    );
    expect(compound?.dependsOn).toContain(
      'Service: Serve notification-event-handler-service',
    );
  });

  it('module wires every handler as a provider', async () => {
    const tree = seedWorkspace();
    await eventHandlerGenerator(tree, {
      domain: 'notification',
      eventTypes: 'NOTIFICATION_SENT,NOTIFICATION_FAILED,NOTIFICATION_RETRIED',
    });
    const moduleSrc = tree.read(
      'apps/notification/notification-event-handler-service/src/modules/notification.module.ts',
      'utf-8',
    ) ?? '';
    expect(moduleSrc).toContain('NotificationSentHandler');
    expect(moduleSrc).toContain('NotificationFailedHandler');
    expect(moduleSrc).toContain('NotificationRetriedHandler');
    expect(moduleSrc).toContain('NotificationEventHandlerService');
    expect(moduleSrc).toContain('SqsLocalService');
    // No HTTP layer
    expect(moduleSrc).not.toContain('controllers:');
  });
});
