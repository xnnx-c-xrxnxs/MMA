import type { DomainContext } from './domain-package';

export const renderDynamoSchema = (ctx: DomainContext): string => {
  const { entity, statuses } = ctx;
  const statusEnum = statuses.length > 0
    ? `${ctx.entity.constant}_STATUSES`
    : '';
  const statusImport = statuses.length > 0
    ? `import { ${statusEnum} } from '../../domain/constants';\n`
    : '';
  const statusModelField = statuses.length > 0
    ? `      ${entity.camel}Status: { type: String, enum: ${statusEnum}, required: true },\n`
    : '';
  const gsi1Block = statuses.length > 0
    ? `      GSI1: { hash: 'GSI1PK', sort: 'GSI1SK' },\n`
    : '';
  const gsi1ModelFields = statuses.length > 0
    ? `      GSI1PK: { type: String, value: '${entity.constant}#\${${entity.camel}Status}', hidden: false },
      GSI1SK: { type: String, value: '\${dateCreated}', hidden: false },\n`
    : '';

  // Generate model field declarations from fields list
  const fieldDecls = ctx.fields
    .map((f) => {
      const onetableType =
        f.type === 'string'
          ? 'String'
          : f.type === 'number'
            ? 'Number'
            : f.type === 'boolean'
              ? 'Boolean'
              : 'Date';
      return `      ${f.name}: { type: ${onetableType}${f.optional ? '' : ', required: true'} },`;
    })
    .join('\n');

  return `import { Entity } from 'dynamodb-onetable';
${statusImport}
export const ${entity.pascal}Schema = {
  version: '0.0.1',
  indexes: {
    primary: { hash: 'PK', sort: 'SK' },
${gsi1Block}  },
  models: {
    ${entity.pascal}: {
      PK: { type: String, value: '${entity.constant}', hidden: false },
      SK: { type: String, value: '\${${entity.camel}Id}', hidden: false },
      ${entity.camel}Id: { type: String, generate: 'ulid' },
${fieldDecls}
${statusModelField}      dateCreated: { type: String },
${gsi1ModelFields}    },
  } as const,
  params: {
    isoDates: true,
    timestamps: true,
  },
};

export type ${entity.pascal}DataType = Entity<typeof ${entity.pascal}Schema.models.${entity.pascal}>;
`;
};

export const renderDynamoRepository = (ctx: DomainContext): string => {
  const { entity, statuses } = ctx;
  const hasStatuses = statuses.length > 0;
  const statusImport = hasStatuses
    ? `import { ${entity.pascal}Status } from '../../domain/constants';\n`
    : '';

  const fieldsToPersistence = ctx.fields
    .map((f) => `      ${f.name}: ${entity.camel}.get${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}(),`)
    .join('\n');

  const fieldsToDomain = ctx.fields
    .map((f) => {
      if (f.type === 'date') {
        const fallback = f.optional ? 'undefined' : 'new Date()';
        return `      ${f.name}: record.${f.name} instanceof Date ? record.${f.name} : (record.${f.name} ? new Date(record.${f.name} as unknown as string) : ${fallback}),`;
      }
      return `      ${f.name}: record.${f.name}${f.optional ? '' : ''},`;
    })
    .join('\n');

  const listByStatus = hasStatuses
    ? `
  async listByStatus(
    ${entity.camel}Status: ${entity.pascal}Status,
    limit = 20,
    direction = 'next',
    nextCursorPointer?: string,
    prevCursorPointer?: string,
  ): Promise<IPaginatedResponse<${entity.pascal}>> {
    const cursorPointer = direction === 'prev' ? prevCursorPointer : nextCursorPointer;
    const dynamoDbOptions = createDynamoDbOptionWithPKSKIndex(
      limit,
      'GSI1',
      direction,
      cursorPointer || '',
    );
    const results = await this.${entity.pascal}Model.find(
      { ${entity.camel}Status },
      dynamoDbOptions,
    );
    const paginated = pageRecordHandler<${entity.pascal}DataType>(
      [...results],
      limit,
      direction,
      'GSI1PK',
      'GSI1SK',
      'PK',
      'SK',
      nextCursorPointer || '',
      prevCursorPointer || '',
    );
    return {
      data: paginated.data.map((item) => this.toDomain(item)),
      nextCursorPointer: paginated.nextCursorPointer,
      prevCursorPointer: paginated.prevCursorPointer,
    };
  }
`
    : '';

  const statusReconstitute = hasStatuses
    ? `      ${entity.camel}Status: record.${entity.camel}Status as ${entity.pascal}Status,\n`
    : '';

  const statusToPersistence = hasStatuses
    ? `      ${entity.camel}Status: ${entity.camel}.get${entity.pascal}Status(),\n`
    : '';

  return `import { Table } from 'dynamodb-onetable';
import { IPaginatedResponse } from '@mma/common';
import {
  pageRecordHandler,
  createDynamoDbOptionWithPKSKIndex,
} from '@mma/dynamodb-onetable';
${statusImport}import { I${entity.pascal}Repository } from '../../application/interfaces/${entity.kebab}-repository.interface';
import { ${entity.pascal} } from '../../domain/entities';
import { ${entity.pascal}DataType } from '../schemas/${entity.pascal}Schema';

interface I${entity.pascal}Model {
  create(properties: object): Promise<${entity.pascal}DataType>;
  upsert(properties: object): Promise<${entity.pascal}DataType>;
  get(properties: object, options?: object): Promise<${entity.pascal}DataType | undefined>;
  find(properties: object, options?: object): Promise<${entity.pascal}DataType[]>;
}

export class Dynamo${entity.pascal}Repository implements I${entity.pascal}Repository {
  private readonly ${entity.pascal}Model: I${entity.pascal}Model;

  constructor(private readonly table: Table) {
    this.${entity.pascal}Model = this.table.getModel('${entity.pascal}') as unknown as I${entity.pascal}Model;
  }

  async save(${entity.camel}: ${entity.pascal}): Promise<${entity.pascal}> {
    const data = this.toPersistence(${entity.camel});
    if (${entity.camel}.get${entity.pascal}Id()) {
      const updated = await this.${entity.pascal}Model.upsert(data);
      return this.toDomain(updated);
    }
    const created = await this.${entity.pascal}Model.create(data);
    return this.toDomain(created);
  }

  async findById(${entity.camel}Id: string): Promise<${entity.pascal} | null> {
    const result = await this.${entity.pascal}Model.get({ ${entity.camel}Id });
    return result ? this.toDomain(result) : null;
  }
${listByStatus}
  private toDomain(raw: ${entity.pascal}DataType): ${entity.pascal} {
    const record = raw as ${entity.pascal}DataType & { createdAt?: Date | string; updatedAt?: Date | string };
    const toIso = (v: Date | string | undefined, fallback: string): string => {
      if (!v) return fallback;
      return v instanceof Date ? v.toISOString() : v;
    };
    const dateCreated = record.dateCreated ?? new Date().toISOString();
    const ${entity.camel}Id = record.${entity.camel}Id;
    if (!${entity.camel}Id) throw new Error('DynamoDB record missing ${entity.camel}Id');

    return ${entity.pascal}.reconstitute({
      ${entity.camel}Id,
${fieldsToDomain}
${statusReconstitute}      dateCreated,
      updatedAt: toIso(record.updatedAt, dateCreated),
    });
  }

  private toPersistence(${entity.camel}: ${entity.pascal}): Partial<${entity.pascal}DataType> {
    const ${entity.camel}Id = ${entity.camel}.get${entity.pascal}Id();
    return {
      ...(${entity.camel}Id && { ${entity.camel}Id }),
${fieldsToPersistence}
${statusToPersistence}      dateCreated: ${entity.camel}.getDateCreated(),
    } as Partial<${entity.pascal}DataType>;
  }
}
`;
};

export const renderRepositoriesBarrel = (ctx: DomainContext): string =>
  `export * from './dynamo-${ctx.entity.kebab}.repository';\n`;

export const renderInfraBarrel = (ctx: DomainContext): string =>
  `export * from './repositories';
export * from './schemas/${ctx.entity.pascal}Schema';
`;

export const renderDomainPackageJson = (ctx: DomainContext): string =>
  JSON.stringify(
    {
      name: `@mma/${ctx.domain.kebab}-domain`,
      version: '1.0.0',
      type: 'module',
      main: './src/index.ts',
      types: './src/index.ts',
      scripts: {},
      dependencies: {
        '@mma/common': 'workspace:*',
        '@mma/dynamodb-onetable': 'workspace:*',
        'dynamodb-onetable': '^2.7.7',
      },
    },
    null,
    2,
  );

export const renderDomainProjectJson = (ctx: DomainContext): string =>
  JSON.stringify(
    {
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: `${ctx.domain.kebab}-domain`,
      sourceRoot: `packages/${ctx.domain.kebab}-domain/src`,
      projectType: 'library',
      tags: [`scope:${ctx.domain.kebab}`, 'type:domain-logic'],
    },
    null,
    2,
  );

export const renderDomainTsconfig = (): string =>
  JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: 'dist' },
      include: ['src/**/*'],
    },
    null,
    2,
  );

export const renderDomainJestConfig = (ctx: DomainContext): string => `import type { Config } from 'jest';

const config: Config = {
  displayName: '${ctx.domain.kebab}-domain',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', useESM: false }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/packages/${ctx.domain.kebab}-domain',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\\\.integration\\\\.spec\\\\.ts$'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  transformIgnorePatterns: ['node_modules/(?!(dynamodb-onetable)/)'],
};

export default config;
`;

export const renderDomainRootBarrel = (): string =>
  `export * from './domain';
export * from './application';
// Infrastructure intentionally NOT exported here.
// Import from '@mma/{domain}-domain/infrastructure' in the composition root only.
`;

// ── Contracts package ───────────────────────────────────────────────────────

export const renderContractsPackageJson = (ctx: DomainContext): string =>
  JSON.stringify(
    {
      name: `@mma/contracts-${ctx.domain.kebab}`,
      version: '1.0.0',
      type: 'module',
      main: './src/index.ts',
      types: './src/index.ts',
      scripts: {},
      dependencies: {
        [`@mma/${ctx.domain.kebab}-domain`]: 'workspace:*',
      },
      peerDependencies: { zod: '>=4.0.0' },
    },
    null,
    2,
  );

export const renderContractsProjectJson = (ctx: DomainContext): string =>
  JSON.stringify(
    {
      $schema: '../../../node_modules/nx/schemas/project-schema.json',
      name: `contracts-${ctx.domain.kebab}`,
      sourceRoot: `packages/contracts/${ctx.domain.kebab}/src`,
      projectType: 'library',
      tags: [`scope:${ctx.domain.kebab}`, 'type:contracts'],
    },
    null,
    2,
  );

export const renderContractsTsconfig = (): string =>
  JSON.stringify(
    {
      extends: '../../../tsconfig.base.json',
      compilerOptions: { outDir: 'dist' },
      include: ['src/**/*'],
    },
    null,
    2,
  );

export const renderContractsIndex = (): string =>
  `export * from './schemas';\n`;

export const renderContractsSchemas = (ctx: DomainContext): string => {
  const { entity, fields, statuses } = ctx;
  const hasStatuses = statuses.length > 0;
  const statusImport = hasStatuses
    ? `import { ${entity.constant}_STATUSES, ${entity.pascal}StatusEnum } from '@mma/${ctx.domain.kebab}-domain';\n`
    : '';
  const statusReExport = hasStatuses
    ? `\nexport { ${entity.constant}_STATUSES, ${entity.pascal}StatusEnum };\nexport const ${entity.camel}StatusSchema = z.enum(${entity.constant}_STATUSES);\n`
    : '';

  const renderZodField = (f: typeof fields[number]): string => {
    const base =
      f.type === 'string'
        ? 'z.string()'
        : f.type === 'number'
          ? 'z.number()'
          : f.type === 'boolean'
            ? 'z.boolean()'
            : 'z.iso.datetime()';
    return `  ${f.name}: ${base}${f.optional ? '.optional()' : ''},`;
  };
  const createFields = fields.map(renderZodField).join('\n');
  const updateFields = fields
    .map((f) => {
      const base =
        f.type === 'string'
          ? 'z.string()'
          : f.type === 'number'
            ? 'z.number()'
            : f.type === 'boolean'
              ? 'z.boolean()'
              : 'z.iso.datetime()';
      return `  ${f.name}: ${base}.optional(),`;
    })
    .join('\n');
  const responseFields = fields
    .map((f) => {
      const base =
        f.type === 'string'
          ? 'z.string()'
          : f.type === 'number'
            ? 'z.number()'
            : f.type === 'boolean'
              ? 'z.boolean()'
              : 'z.iso.datetime()';
      return `  ${f.name}: ${base}${f.optional ? '.optional()' : ''},`;
    })
    .join('\n');

  const responseStatusLine = hasStatuses
    ? `  ${entity.camel}Status: ${entity.camel}StatusSchema,\n`
    : '';

  return `import { z } from 'zod';
${statusImport}${statusReExport}
export const create${entity.pascal}Schema = z.object({
${createFields}
});

export const update${entity.pascal}Schema = z.object({
${updateFields}
});

export const ${entity.camel}ResponseSchema = z.object({
  ${entity.camel}Id: z.string(),
${responseFields}
${responseStatusLine}  dateCreated: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Create${entity.pascal}Input = z.infer<typeof create${entity.pascal}Schema>;
export type Update${entity.pascal}Input = z.infer<typeof update${entity.pascal}Schema>;
export type ${entity.pascal}Response = z.infer<typeof ${entity.camel}ResponseSchema>;
`;
};
