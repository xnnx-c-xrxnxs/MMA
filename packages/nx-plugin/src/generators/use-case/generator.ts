import type { Tree } from '@nx/devkit';
import { formatFiles, logger } from '@nx/devkit';
import type { UseCaseGeneratorSchema, UseCaseType } from './schema';
import type { FieldSpec } from '../lib';
import { buildDomainNames, validateDomainName, parseFieldsSpec } from '../lib';

const tsTypeOf = (f: FieldSpec): string => {
  // Use the same TS type as the entity's create() props (string|number|boolean|Date)
  // so the use-case input maps 1:1 to Entity.create({...}).
  return f.optional ? `${f.tsType} | undefined` : f.tsType;
};

interface BuiltContext {
  domain: ReturnType<typeof buildDomainNames>;
  entity: ReturnType<typeof buildDomainNames>;
  verb: ReturnType<typeof buildDomainNames>;
  type: UseCaseType;
  /** e.g. "cancel-shipment" */
  useCaseDirName: string;
  /** e.g. "CancelShipment" */
  useCasePrefix: string;
  /** e.g. "list-shipments-by-status" */
  filterField: string;
  /** entity method to call for action type */
  actionMethod: string;
  /** parsed entity fields (when supplied by the domain generator) */
  fields: FieldSpec[] | null;
}

const buildContext = (schema: UseCaseGeneratorSchema): BuiltContext => {
  validateDomainName(schema.domain);
  const domain = buildDomainNames(schema.domain);
  const entity = buildDomainNames(schema.entity ?? schema.domain);
  const verb = buildDomainNames(schema.verb);

  const useCaseDirName =
    schema.type === 'list'
      ? `list-${entity.kebabPlural}-by-${(schema.filterField ?? 'status')}`
      : `${verb.kebab}-${entity.kebab}`;
  const useCasePrefix =
    schema.type === 'list'
      ? `List${entity.pascalPlural}By${pascalize(schema.filterField ?? 'status')}`
      : `${verb.pascal}${entity.pascal}`;

  return {
    domain,
    entity,
    verb,
    type: schema.type,
    useCaseDirName,
    useCasePrefix,
    filterField: schema.filterField ?? 'status',
    actionMethod: schema.actionMethod ?? verb.camel,
    fields: schema.fields ? parseFieldsSpec(schema.fields) : null,
  };
};

const pascalize = (s: string): string =>
  s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

const renderUseCase = (ctx: BuiltContext): string => {
  const { entity, useCasePrefix, type, actionMethod, filterField } = ctx;
  const repoIface = `I${entity.pascal}Repository`;
  const repoVar = `${entity.camel}Repository`;
  const notFound = `${entity.pascal}NotFoundError`;

  switch (type) {
    case 'create': {
      const inputBody = ctx.fields
        ? ctx.fields.map((f) => `  ${f.name}: ${tsTypeOf(f)};`).join('\n')
        : '  // TODO: declare input fields here (primitives only — no DTOs)';
      const createCallBody = ctx.fields
        ? ctx.fields.map((f) => `      ${f.name}: input.${f.name},`).join('\n')
        : '      // TODO: map input → entity creation parameters';
      return `import { IUseCase } from '@old-st/common';
import { ${repoIface} } from '../../interfaces/${entity.kebab}-repository.interface';
import { ${entity.pascal} } from '../../../domain/entities';

export interface ${useCasePrefix}Input {
${inputBody}
}

export class ${useCasePrefix}UseCase implements IUseCase<${useCasePrefix}Input, ${entity.pascal}> {
  constructor(private readonly ${repoVar}: ${repoIface}) {}

  async execute(input: ${useCasePrefix}Input): Promise<${entity.pascal}> {
    // TODO: optional uniqueness check via ${repoVar}.findBy<UniqueField>(...)
    const ${entity.camel} = ${entity.pascal}.create({
${createCallBody}
    });
    return await this.${repoVar}.save(${entity.camel});
  }
}
`;
    }

    case 'get-by-id':
      return `import { IUseCase } from '@old-st/common';
import { ${repoIface} } from '../../interfaces/${entity.kebab}-repository.interface';
import { ${entity.pascal} } from '../../../domain/entities';
import { InvalidInputError, ${notFound} } from '../../exceptions';

export class ${useCasePrefix}UseCase implements IUseCase<string, ${entity.pascal}> {
  constructor(private readonly ${repoVar}: ${repoIface}) {}

  async execute(${entity.camel}Id: string): Promise<${entity.pascal}> {
    if (!${entity.camel}Id) {
      throw new InvalidInputError('${entity.pascal} ID is required');
    }
    const ${entity.camel} = await this.${repoVar}.findById(${entity.camel}Id);
    if (!${entity.camel}) {
      throw new ${notFound}(${entity.camel}Id);
    }
    return ${entity.camel};
  }
}
`;

    case 'update': {
      // For update, all fields become optional (so callers may patch any subset).
      const updateInputBody = ctx.fields
        ? ctx.fields.map((f) => `  ${f.name}?: ${tsTypeOf(f).replace(' | undefined', '')};`).join('\n')
        : '  // TODO: add updatable fields here (all optional)';
      return `import { IUseCase } from '@old-st/common';
import { ${repoIface} } from '../../interfaces/${entity.kebab}-repository.interface';
import { ${entity.pascal} } from '../../../domain/entities';
import { InvalidInputError, ${notFound} } from '../../exceptions';

export interface ${useCasePrefix}Input {
  ${entity.camel}Id: string;
${updateInputBody}
}

export class ${useCasePrefix}UseCase implements IUseCase<${useCasePrefix}Input, ${entity.pascal}> {
  constructor(private readonly ${repoVar}: ${repoIface}) {}

  async execute(input: ${useCasePrefix}Input): Promise<${entity.pascal}> {
    if (!input.${entity.camel}Id) {
      throw new InvalidInputError('${entity.pascal} ID is required');
    }
    const ${entity.camel} = await this.${repoVar}.findById(input.${entity.camel}Id);
    if (!${entity.camel}) {
      throw new ${notFound}(input.${entity.camel}Id);
    }
    // TODO: invoke entity update methods (entity enforces invariants)
    return await this.${repoVar}.save(${entity.camel});
  }
}
`;
    }

    case 'delete':
      return `import { IUseCase } from '@old-st/common';
import { ${repoIface} } from '../../interfaces/${entity.kebab}-repository.interface';
import { ${entity.pascal} } from '../../../domain/entities';
import { InvalidInputError, ${notFound} } from '../../exceptions';

export class ${useCasePrefix}UseCase implements IUseCase<string, ${entity.pascal}> {
  constructor(private readonly ${repoVar}: ${repoIface}) {}

  async execute(${entity.camel}Id: string): Promise<${entity.pascal}> {
    if (!${entity.camel}Id) {
      throw new InvalidInputError('${entity.pascal} ID is required');
    }
    const ${entity.camel} = await this.${repoVar}.findById(${entity.camel}Id);
    if (!${entity.camel}) {
      throw new ${notFound}(${entity.camel}Id);
    }
    // Domain method enforces: cannot delete an already-deleted entity
    ${entity.camel}.markAsDeleted();
    return await this.${repoVar}.save(${entity.camel});
  }
}
`;

    case 'action':
      return `import { IUseCase } from '@old-st/common';
import { ${repoIface} } from '../../interfaces/${entity.kebab}-repository.interface';
import { ${entity.pascal} } from '../../../domain/entities';
import { InvalidInputError, ${notFound} } from '../../exceptions';

export class ${useCasePrefix}UseCase implements IUseCase<string, ${entity.pascal}> {
  constructor(private readonly ${repoVar}: ${repoIface}) {}

  async execute(${entity.camel}Id: string): Promise<${entity.pascal}> {
    if (!${entity.camel}Id) {
      throw new InvalidInputError('${entity.pascal} ID is required');
    }
    const ${entity.camel} = await this.${repoVar}.findById(${entity.camel}Id);
    if (!${entity.camel}) {
      throw new ${notFound}(${entity.camel}Id);
    }
    // Domain method enforces business rules (state transitions, guards)
    ${entity.camel}.${actionMethod}();
    return await this.${repoVar}.save(${entity.camel});
  }
}
`;

    case 'list': {
      const filterPascal = pascalize(filterField);
      // When invoked from the domain generator (fields provided) and the filter
      // field is the status enum, import the typed union from constants so the
      // call to repo.listByStatus() type-checks. Otherwise fall back to string.
      const isStatusFilter = filterField === 'status' && ctx.fields !== null;
      const statusImport = isStatusFilter
        ? `import { ${entity.pascal}Status } from '../../../domain/constants';\n`
        : '';
      const filterType = isStatusFilter ? `${entity.pascal}Status` : 'string';
      return `import { IUseCase, IPaginatedResponse } from '@old-st/common';
import { ${repoIface} } from '../../interfaces/${entity.kebab}-repository.interface';
import { ${entity.pascal} } from '../../../domain/entities';
${statusImport}import { InvalidInputError } from '../../exceptions';

export interface ${useCasePrefix}Input {
  ${filterField}: ${filterType};
  limit?: number;
  direction?: string;
  nextCursorPointer?: string;
  prevCursorPointer?: string;
}

export class ${useCasePrefix}UseCase implements IUseCase<${useCasePrefix}Input, IPaginatedResponse<${entity.pascal}>> {
  constructor(private readonly ${repoVar}: ${repoIface}) {}

  async execute(input: ${useCasePrefix}Input): Promise<IPaginatedResponse<${entity.pascal}>> {
    if (!input.${filterField}) {
      throw new InvalidInputError('${filterPascal} is required');
    }
    return await this.${repoVar}.listBy${filterPascal}(
      input.${filterField},
      input.limit,
      input.direction,
      input.nextCursorPointer,
      input.prevCursorPointer,
    );
  }
}
`;
    }
  }
};

const renderSpec = (ctx: BuiltContext): string => {
  const { entity, useCasePrefix } = ctx;
  return `import { ${useCasePrefix}UseCase } from './${ctx.useCaseDirName}.use-case';

describe('${useCasePrefix}UseCase', () => {
  it('is constructible with a repository mock', () => {
    const repo = {} as never;
    const useCase = new ${useCasePrefix}UseCase(repo);
    expect(useCase).toBeInstanceOf(${useCasePrefix}UseCase);
  });

  // TODO: add behavioural tests covering happy path + error branches
  // (e.g. ${entity.pascal}NotFoundError, InvalidInputError, domain exceptions)
});
`;
};

const updateBarrel = (tree: Tree, ctx: BuiltContext, packagePath: string): void => {
  const barrelPath = `${packagePath}/src/application/use-cases/index.ts`;
  const exportLine = `export * from './${ctx.useCaseDirName}/${ctx.useCaseDirName}.use-case';`;
  let existing = '';
  if (tree.exists(barrelPath)) {
    existing = tree.read(barrelPath, 'utf-8') ?? '';
    if (existing.includes(exportLine)) return;
  }
  const sep = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  tree.write(barrelPath, existing + sep + exportLine + '\n');
};

export default async function useCaseGenerator(
  tree: Tree,
  schema: UseCaseGeneratorSchema,
): Promise<void> {
  const ctx = buildContext(schema);
  const packagePath = `packages/${ctx.domain.kebab}-domain`;

  if (!tree.exists(packagePath)) {
    throw new Error(
      `use-case generator: domain package '${packagePath}' does not exist. Run \`pnpm nx g @old-st/nx-plugin:domain ${ctx.domain.kebab}\` first to scaffold the domain.`,
    );
  }

  const fileBase = `${packagePath}/src/application/use-cases/${ctx.useCaseDirName}`;
  const useCasePath = `${fileBase}/${ctx.useCaseDirName}.use-case.ts`;
  const specPath = `${fileBase}/${ctx.useCaseDirName}.use-case.spec.ts`;

  if (tree.exists(useCasePath)) {
    throw new Error(
      `use-case generator: ${useCasePath} already exists. Aborting to avoid overwriting custom code.`,
    );
  }

  tree.write(useCasePath, renderUseCase(ctx));
  tree.write(specPath, renderSpec(ctx));
  updateBarrel(tree, ctx, packagePath);

  // formatFiles uses dynamic import for Prettier which fails under Jest's CJS
  // VM. We skip it in tests; the CLI runs it normally.
  if (!process.env.JEST_WORKER_ID) {
    await formatFiles(tree);
  }

  logger.info(
    `\n[@old-st/nx-plugin:use-case] Generated ${ctx.useCasePrefix}UseCase\n` +
      `  → ${useCasePath}\n` +
      `  → ${specPath}\n\n` +
      `Next steps:\n` +
      `  1. Open the use case and fill in the TODO blocks (input fields / entity method calls).\n` +
      `  2. Wire it into your service module:\n` +
      `       - Add a provider in apps/${ctx.domain.kebab}/${ctx.domain.kebab}-api-service/src/modules/${ctx.domain.kebab}.module.ts\n` +
      `       - Inject it into the application service constructor.\n` +
      `  3. Add a controller route in presentation/controllers/${ctx.entity.kebab}.controller.ts.\n`,
  );
}
