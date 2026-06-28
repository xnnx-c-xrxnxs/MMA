import { createTree } from '@nx/devkit/testing';
import domainGenerator from './generator';

const seedWorkspace = () => {
  const tree = createTree();
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
        infrastructure: { dynamodbTables: [], sqsQueues: [], rds: [], s3Buckets: [] },
        deployTasks: [],
        gatewayAuth: { enabled: true, publicRoutes: [] },
      },
      null,
      2,
    ),
  );
  tree.write(
    '.github/service-registry.env',
    '# E2E env\nUSER_SERVICE_PORT=3000\nORDER_SERVICE_PORT=3002\n',
  );
  tree.write('.env.local.example', '# defaults\nSTAGE=local\n');
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
            problemMatcher: [],
          },
        ],
      },
      null,
      2,
    ),
  );
  // Minimal setup-localstack.ts with a TABLE_CONFIGS array we can append to
  tree.write(
    'scripts/setup-localstack.ts',
    `// fake setup-localstack.ts
interface TableConfig {}
const TABLE_CONFIGS: TableConfig[] = [
  // existing entries
];
console.log(TABLE_CONFIGS);
`,
  );
  return tree;
};

describe('domain generator', () => {
  it('rejects invalid domain name', async () => {
    const tree = seedWorkspace();
    await expect(domainGenerator(tree, { name: 'Shipping' })).rejects.toThrow();
  });

  it('rejects unsupported persistence', async () => {
    const tree = seedWorkspace();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      domainGenerator(tree, { name: 'shipping', persistence: 'prisma' as any }),
    ).rejects.toThrow(/not yet supported/);
  });

  it('rejects unsupported use case', async () => {
    const tree = seedWorkspace();
    await expect(
      domainGenerator(tree, { name: 'shipping', useCases: 'create,foo' }),
    ).rejects.toThrow(/unsupported use case/);
  });

  it('aborts when domain package already exists', async () => {
    const tree = seedWorkspace();
    tree.write('packages/shipping-domain/package.json', '{}');
    await expect(domainGenerator(tree, { name: 'shipping' })).rejects.toThrow(/already exists/);
  });

  it('dry-run: writes nothing but logs the file plan', async () => {
    const tree = seedWorkspace();
    await domainGenerator(tree, { name: 'shipping', dryRun: true, withService: false });
    expect(tree.exists('packages/shipping-domain/package.json')).toBe(false);
    expect(tree.exists('packages/contracts/shipping/package.json')).toBe(false);
    // tsconfig path aliases should not have been touched
    const ts = JSON.parse(tree.read('tsconfig.base.json', 'utf-8') ?? '{}');
    expect(ts.compilerOptions.paths).toEqual({});
  });

  it('scaffolds a complete shipping domain end-to-end', async () => {
    const tree = seedWorkspace();
    await domainGenerator(tree, {
      name: 'shipping',
      entity: 'shipment',
      fields: 'orderId:string,trackingNumber:string,weight:number,address:string?',
      statuses: 'PENDING,IN_TRANSIT,DELIVERED,CANCELLED',
      useCases: 'create,get-by-id,list',
    });

    // Domain package
    const dom = 'packages/shipping-domain';
    for (const p of [
      `${dom}/package.json`,
      `${dom}/project.json`,
      `${dom}/tsconfig.json`,
      `${dom}/jest.config.ts`,
      `${dom}/src/index.ts`,
      `${dom}/src/domain/index.ts`,
      `${dom}/src/domain/entities/shipment.entity.ts`,
      `${dom}/src/domain/entities/shipment.entity.spec.ts`,
      `${dom}/src/domain/entities/index.ts`,
      `${dom}/src/domain/constants/shipment-statuses.ts`,
      `${dom}/src/domain/constants/index.ts`,
      `${dom}/src/domain/exceptions/shipment-already-deleted.error.ts`,
      `${dom}/src/domain/exceptions/index.ts`,
      `${dom}/src/application/index.ts`,
      `${dom}/src/application/exceptions/invalid-input.error.ts`,
      `${dom}/src/application/exceptions/shipment-not-found.error.ts`,
      `${dom}/src/application/interfaces/shipment-repository.interface.ts`,
      `${dom}/src/application/use-cases/index.ts`,
      `${dom}/src/infrastructure/index.ts`,
      `${dom}/src/infrastructure/schemas/ShipmentSchema.ts`,
      `${dom}/src/infrastructure/repositories/dynamo-shipment.repository.ts`,
      `${dom}/src/infrastructure/repositories/index.ts`,
      `${dom}/TODO.md`,
    ]) {
      expect(tree.exists(p)).toBe(true);
    }

    // Contracts package
    const ct = 'packages/contracts/shipping';
    expect(tree.exists(`${ct}/package.json`)).toBe(true);
    expect(tree.exists(`${ct}/src/schemas.ts`)).toBe(true);

    // Service shell
    const svc = 'apps/shipping/shipping-api-service';
    expect(tree.exists(`${svc}/project.json`)).toBe(true);
    expect(tree.exists(`${svc}/src/main.ts`)).toBe(true);

    // Use cases generated
    expect(tree.exists(
      `${dom}/src/application/use-cases/create-shipment/create-shipment.use-case.ts`,
    )).toBe(true);
    expect(tree.exists(
      `${dom}/src/application/use-cases/get-shipment/get-shipment.use-case.ts`,
    )).toBe(true);
    expect(tree.exists(
      `${dom}/src/application/use-cases/list-shipments-by-status/list-shipments-by-status.use-case.ts`,
    )).toBe(true);

    // Path aliases registered
    const tsconfig = JSON.parse(tree.read('tsconfig.base.json', 'utf-8') ?? '{}');
    expect(tsconfig.compilerOptions.paths['@mma/shipping-domain']).toEqual([
      'packages/shipping-domain/src/index.ts',
    ]);
    expect(tsconfig.compilerOptions.paths['@mma/shipping-domain/infrastructure']).toEqual([
      'packages/shipping-domain/src/infrastructure/index.ts',
    ]);
    expect(tsconfig.compilerOptions.paths['@mma/contracts/shipping']).toEqual([
      'packages/contracts/shipping/src/index.ts',
    ]);

    // Service registry: api service AND dynamodb table
    const reg = JSON.parse(tree.read('.github/service-registry.json', 'utf-8') ?? '{}');
    expect(reg.apiServices.find((s: { name: string }) => s.name === 'shipping-api-service')).toBeDefined();
    expect(reg.infrastructure.dynamodbTables.find(
      (t: { envVar: string }) => t.envVar === 'SHIPPINGS_DYNAMODB_TABLE_NAME',
    )).toBeDefined();

    // setup-localstack updated
    const ls = tree.read('scripts/setup-localstack.ts', 'utf-8') ?? '';
    expect(ls).toContain('SHIPPINGS_DYNAMODB_TABLE_NAME');
    expect(ls).toContain('ShipmentSchema');

    // Use-case barrel populated
    const ucBarrel = tree.read(`${dom}/src/application/use-cases/index.ts`, 'utf-8') ?? '';
    expect(ucBarrel).toContain('create-shipment');
    expect(ucBarrel).toContain('get-shipment');
    expect(ucBarrel).toContain('list-shipments-by-status');
  });

  it('embeds field declarations into the entity and schema', async () => {
    const tree = seedWorkspace();
    await domainGenerator(tree, {
      name: 'shipping',
      entity: 'shipment',
      fields: 'orderId:string,weight:number,address:string?',
      statuses: 'PENDING,DELIVERED',
      useCases: 'create',
    });

    const entity = tree.read(
      'packages/shipping-domain/src/domain/entities/shipment.entity.ts',
      'utf-8',
    ) ?? '';
    expect(entity).toContain('private orderId: string,');
    expect(entity).toContain('private weight: number,');
    // optional → `... | undefined`
    expect(entity).toContain('address: string | undefined,');
    expect(entity).toContain('getOrderId(): string');
    expect(entity).toContain('getAddress(): string | undefined');

    const schema = tree.read(
      'packages/shipping-domain/src/infrastructure/schemas/ShipmentSchema.ts',
      'utf-8',
    ) ?? '';
    expect(schema).toContain("orderId: { type: String, required: true }");
    expect(schema).toContain('weight: { type: Number, required: true }');
    expect(schema).toContain('address: { type: String }');
  });

  it('auto-appends DELETED to statuses when delete is in use cases', async () => {
    const tree = seedWorkspace();
    await domainGenerator(tree, {
      name: 'shipping',
      entity: 'shipment',
      fields: 'orderId:string',
      statuses: 'PENDING,DELIVERED',
      useCases: 'create,delete',
    });
    const statusesFile = tree.read(
      'packages/shipping-domain/src/domain/constants/shipment-statuses.ts',
      'utf-8',
    ) ?? '';
    expect(statusesFile).toContain('DELETED');

    const entity = tree.read(
      'packages/shipping-domain/src/domain/entities/shipment.entity.ts',
      'utf-8',
    ) ?? '';
    expect(entity).toContain('markAsDeleted()');
    expect(entity).toContain('isDeleted()');
  });

  it('skips contracts package when withContracts=false', async () => {
    const tree = seedWorkspace();
    await domainGenerator(tree, {
      name: 'shipping',
      withContracts: false,
      withService: false,
      useCases: 'create',
    });
    expect(tree.exists('packages/contracts/shipping/package.json')).toBe(false);
    const ts = JSON.parse(tree.read('tsconfig.base.json', 'utf-8') ?? '{}');
    expect(ts.compilerOptions.paths['@mma/contracts/shipping']).toBeUndefined();
  });

  it('skips service when withService=false', async () => {
    const tree = seedWorkspace();
    await domainGenerator(tree, {
      name: 'shipping',
      withService: false,
      useCases: 'create',
    });
    expect(tree.exists('apps/shipping/shipping-api-service/project.json')).toBe(false);
  });
});
