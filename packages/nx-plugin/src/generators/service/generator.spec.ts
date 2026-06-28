import { createTree } from '@nx/devkit/testing';
import serviceGenerator from './generator';

const seedWorkspace = () => {
  const tree = createTree();
  // Minimal artifacts needed by the workspace-update utilities
  tree.write(
    'tsconfig.base.json',
    JSON.stringify({ compilerOptions: { paths: {} } }, null, 2),
  );
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
    '.github/service-registry.env',
    '# E2E env vars\nUSER_SERVICE_PORT=3000\nORDER_SERVICE_PORT=3002\n',
  );
  tree.write('.env.local.example', '# Workspace defaults\nSTAGE=local\nNODE_ENV=production\n');
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
  return tree;
};

describe('service generator', () => {
  it('rejects invalid domain names', async () => {
    const tree = seedWorkspace();
    await expect(serviceGenerator(tree, { domain: 'Shipping' })).rejects.toThrow();
  });

  it('rejects unsupported persistence', async () => {
    const tree = seedWorkspace();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      serviceGenerator(tree, { domain: 'shipping', persistence: 'prisma' as any }),
    ).rejects.toThrow(/not yet supported/);
  });

  it('throws when service folder already exists', async () => {
    const tree = seedWorkspace();
    tree.write('apps/shipping/shipping-api-service/project.json', '{}');
    await expect(serviceGenerator(tree, { domain: 'shipping' })).rejects.toThrow(/already exists/);
  });

  it('generates the full service shell at the expected paths', async () => {
    const tree = seedWorkspace();
    await serviceGenerator(tree, { domain: 'shipping' });

    const root = 'apps/shipping/shipping-api-service';
    const expected = [
      `${root}/project.json`,
      `${root}/tsconfig.json`,
      `${root}/tsconfig.app.json`,
      `${root}/tsconfig.spec.json`,
      `${root}/jest.config.cts`,
      `${root}/webpack.config.js`,
      `${root}/src/main.ts`,
      `${root}/src/app/app.module.ts`,
      `${root}/src/app/app.controller.ts`,
      `${root}/src/app/app.controller.spec.ts`,
      `${root}/src/modules/shipping.module.ts`,
      `${root}/src/application/services/shipping-application.service.ts`,
      `${root}/src/application/services/shipping-application.service.spec.ts`,
      `${root}/src/infrastructure/config/jwt.config.ts`,
      `${root}/src/infrastructure/config/dynamodb.config.ts`,
      `${root}/src/presentation/index.ts`,
      `${root}/src/presentation/controllers/shipping.controller.ts`,
      `${root}/src/presentation/controllers/shipping.controller.spec.ts`,
      `${root}/src/presentation/pipes/zod-validation.pipe.ts`,
      `${root}/src/presentation/pipes/zod-validation.pipe.spec.ts`,
      `${root}/src/presentation/filters/domain-exception.filter.ts`,
      `${root}/src/presentation/guards/jwt-auth.guard.ts`,
      `${root}/src/presentation/decorators/public.decorator.ts`,
      `${root}/src/presentation/decorators/current-user.decorator.ts`,
      `${root}/src/presentation/types/express.d.ts`,
    ];
    for (const path of expected) {
      expect(tree.exists(path)).toBe(true);
    }
  });

  it('embeds the domain name in main.ts, app.module.ts, and the application service', async () => {
    const tree = seedWorkspace();
    await serviceGenerator(tree, { domain: 'shipping' });

    const main = tree.read(
      'apps/shipping/shipping-api-service/src/main.ts',
      'utf-8',
    ) ?? '';
    expect(main).toContain("initTelemetry('shipping-api-service')");
    expect(main).toContain('SHIPPING_SERVICE_PORT');

    const appModule = tree.read(
      'apps/shipping/shipping-api-service/src/app/app.module.ts',
      'utf-8',
    ) ?? '';
    expect(appModule).toContain('ShippingModule');

    const appService = tree.read(
      'apps/shipping/shipping-api-service/src/application/services/shipping-application.service.ts',
      'utf-8',
    ) ?? '';
    expect(appService).toContain('class ShippingApplicationService');
    expect(appService).toContain("createLogger('shipping-api-service')");
  });

  it('updates service-registry.json with the new API service entry', async () => {
    const tree = seedWorkspace();
    await serviceGenerator(tree, { domain: 'shipping' });
    const registry = JSON.parse(tree.read('.github/service-registry.json', 'utf-8') ?? '{}');
    const entry = registry.apiServices.find(
      (s: { name: string }) => s.name === 'shipping-api-service',
    );
    expect(entry).toBeDefined();
    expect(entry.domain).toBe('shipping');
    expect(entry.envVars).toContain('SHIPPINGS_DYNAMODB_TABLE_NAME');
  });

  it('appends env section with next available port', async () => {
    const tree = seedWorkspace();
    await serviceGenerator(tree, { domain: 'shipping' });
    const env = tree.read('.env.local.example', 'utf-8') ?? '';
    expect(env).toContain('# --- shipping-api-service');
    expect(env).toMatch(/SHIPPING_SERVICE_PORT=\d+/);
    expect(env).toContain('API_SHIPPING_URL=http://localhost:');
  });

  it('registers the serve task in .vscode/tasks.json', async () => {
    const tree = seedWorkspace();
    await serviceGenerator(tree, { domain: 'shipping' });
    const tasksJson = JSON.parse(tree.read('.vscode/tasks.json', 'utf-8') ?? '{}');
    const serveTask = tasksJson.tasks.find(
      (t: { label?: string }) => t.label === 'Service: Serve shipping-api-service',
    );
    expect(serveTask).toBeDefined();
    const startAll = tasksJson.tasks.find(
      (t: { label?: string }) => t.label === 'Services: Start All',
    );
    expect(startAll.dependsOn).toContain('Service: Serve shipping-api-service');
  });

  it('uses entity name when provided to override the default file naming', async () => {
    const tree = seedWorkspace();
    await serviceGenerator(tree, { domain: 'shipping', entity: 'shipment' });

    const root = 'apps/shipping/shipping-api-service';
    expect(tree.exists(`${root}/src/modules/shipment.module.ts`)).toBe(true);
    expect(tree.exists(
      `${root}/src/application/services/shipment-application.service.ts`,
    )).toBe(true);
    expect(tree.exists(
      `${root}/src/presentation/controllers/shipment.controller.ts`,
    )).toBe(true);

    const appModule = tree.read(`${root}/src/app/app.module.ts`, 'utf-8') ?? '';
    expect(appModule).toContain('ShipmentModule');
  });
});
