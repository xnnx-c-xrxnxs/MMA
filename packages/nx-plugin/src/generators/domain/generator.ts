import type { Tree } from '@nx/devkit';
import { formatFiles, logger } from '@nx/devkit';
import type { DomainGeneratorSchema } from './schema';
import {
  buildDomainNames,
  validateDomainName,
  parseFieldsSpec,
  parseStatusesSpec,
  addPathAliases,
  addDynamoTableEntry,
  addLocalstackTable,
} from '../lib';
import serviceGenerator from '../service/generator';
import useCaseGenerator from '../use-case/generator';
import {
  renderEntity,
  renderEntitySpec,
  renderStatusesConst,
  renderConstantsBarrel,
  renderDomainBarrel,
  renderEntitiesBarrel,
  renderDomainExceptions,
  renderDomainExceptionsBarrel,
  renderApplicationExceptions,
  renderApplicationExceptionsBarrel,
  renderApplicationBarrel,
  renderRepositoryInterface,
  renderUseCasesBarrel,
  type DomainContext,
} from './templates/domain-package';
import {
  renderDynamoSchema,
  renderDynamoRepository,
  renderRepositoriesBarrel,
  renderInfraBarrel,
  renderDomainPackageJson,
  renderDomainProjectJson,
  renderDomainTsconfig,
  renderDomainJestConfig,
  renderDomainRootBarrel,
  renderContractsPackageJson,
  renderContractsProjectJson,
  renderContractsTsconfig,
  renderContractsIndex,
  renderContractsSchemas,
} from './templates/persistence-and-contracts';

const SUPPORTED_USE_CASES = ['create', 'get-by-id', 'update', 'delete', 'list'] as const;
type SupportedUseCase = (typeof SUPPORTED_USE_CASES)[number];

const parseUseCases = (spec: string | undefined): SupportedUseCase[] => {
  const raw = (spec ?? 'create,get-by-id,list')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const v of raw) {
    if (!SUPPORTED_USE_CASES.includes(v as SupportedUseCase)) {
      throw new Error(
        `domain generator: unsupported use case '${v}'. Supported: ${SUPPORTED_USE_CASES.join(', ')}.`,
      );
    }
  }
  return raw as SupportedUseCase[];
};

const buildContext = (schema: DomainGeneratorSchema): DomainContext => {
  validateDomainName(schema.name);
  if (schema.entity) validateDomainName(schema.entity);
  const domain = buildDomainNames(schema.name);
  const entity = buildDomainNames(schema.entity ?? schema.name);
  const fields = parseFieldsSpec(schema.fields);
  const statuses = parseStatusesSpec(schema.statuses ?? 'ACTIVE,DELETED');
  // Auto-add DELETED if a delete use case is requested
  const useCases = parseUseCases(schema.useCases);
  if (useCases.includes('delete') && !statuses.includes('DELETED')) {
    statuses.push('DELETED');
  }
  return {
    domain,
    entity,
    fields,
    statuses,
    hasDeleted: statuses.includes('DELETED'),
  };
};

export default async function domainGenerator(
  tree: Tree,
  schema: DomainGeneratorSchema,
): Promise<void> {
  const persistence = schema.persistence ?? 'dynamodb';
  if (persistence !== 'dynamodb') {
    throw new Error(
      `domain generator: persistence='${persistence}' is not yet supported. Use 'dynamodb'.`,
    );
  }

  const ctx = buildContext(schema);
  const useCases = parseUseCases(schema.useCases);
  const writes: string[] = [];

  const domainRoot = `packages/${ctx.domain.kebab}-domain`;
  const contractsRoot = `packages/contracts/${ctx.domain.kebab}`;

  if (tree.exists(domainRoot)) {
    throw new Error(
      `domain generator: ${domainRoot} already exists. Aborting to avoid overwriting an existing domain.`,
    );
  }
  if ((schema.withContracts ?? true) && tree.exists(contractsRoot)) {
    throw new Error(
      `domain generator: ${contractsRoot} already exists. Aborting to avoid overwriting an existing contracts package.`,
    );
  }

  // ── Domain package ────────────────────────────────────────────────────
  const w = (path: string, content: string) => {
    writes.push(path);
    if (!schema.dryRun) tree.write(path, content);
  };

  w(`${domainRoot}/package.json`, renderDomainPackageJson(ctx));
  w(`${domainRoot}/project.json`, renderDomainProjectJson(ctx));
  w(`${domainRoot}/tsconfig.json`, renderDomainTsconfig());
  w(`${domainRoot}/jest.config.ts`, renderDomainJestConfig(ctx));
  w(`${domainRoot}/src/index.ts`, renderDomainRootBarrel());

  // Domain layer
  w(`${domainRoot}/src/domain/index.ts`, renderDomainBarrel(ctx));
  if (ctx.statuses.length > 0) {
    w(
      `${domainRoot}/src/domain/constants/${ctx.entity.kebab}-statuses.ts`,
      renderStatusesConst(ctx),
    );
    w(`${domainRoot}/src/domain/constants/index.ts`, renderConstantsBarrel(ctx));
  }
  w(`${domainRoot}/src/domain/entities/${ctx.entity.kebab}.entity.ts`, renderEntity(ctx));
  w(
    `${domainRoot}/src/domain/entities/${ctx.entity.kebab}.entity.spec.ts`,
    renderEntitySpec(ctx),
  );
  w(`${domainRoot}/src/domain/entities/index.ts`, renderEntitiesBarrel(ctx));
  for (const [filename, content] of renderDomainExceptions(ctx)) {
    w(`${domainRoot}/src/domain/exceptions/${filename}`, content);
  }
  w(`${domainRoot}/src/domain/exceptions/index.ts`, renderDomainExceptionsBarrel(ctx));

  // Application layer
  w(`${domainRoot}/src/application/index.ts`, renderApplicationBarrel(ctx));
  for (const [filename, content] of renderApplicationExceptions(ctx)) {
    w(`${domainRoot}/src/application/exceptions/${filename}`, content);
  }
  w(
    `${domainRoot}/src/application/exceptions/index.ts`,
    renderApplicationExceptionsBarrel(ctx),
  );
  w(
    `${domainRoot}/src/application/interfaces/${ctx.entity.kebab}-repository.interface.ts`,
    renderRepositoryInterface(ctx),
  );
  w(`${domainRoot}/src/application/interfaces/index.ts`,
    `export * from './${ctx.entity.kebab}-repository.interface';\n`);
  w(`${domainRoot}/src/application/use-cases/index.ts`, renderUseCasesBarrel());

  // Infrastructure layer
  w(`${domainRoot}/src/infrastructure/index.ts`, renderInfraBarrel(ctx));
  w(
    `${domainRoot}/src/infrastructure/schemas/${ctx.entity.pascal}Schema.ts`,
    renderDynamoSchema(ctx),
  );
  w(
    `${domainRoot}/src/infrastructure/repositories/dynamo-${ctx.entity.kebab}.repository.ts`,
    renderDynamoRepository(ctx),
  );
  w(
    `${domainRoot}/src/infrastructure/repositories/index.ts`,
    renderRepositoriesBarrel(ctx),
  );

  // ── Contracts package ─────────────────────────────────────────────────
  if (schema.withContracts ?? true) {
    w(`${contractsRoot}/package.json`, renderContractsPackageJson(ctx));
    w(`${contractsRoot}/project.json`, renderContractsProjectJson(ctx));
    w(`${contractsRoot}/tsconfig.json`, renderContractsTsconfig());
    w(`${contractsRoot}/src/index.ts`, renderContractsIndex());
    w(`${contractsRoot}/src/schemas.ts`, renderContractsSchemas(ctx));
  }

  // ── Workspace updates (skipped on dry-run) ────────────────────────────
  if (!schema.dryRun) {
    addPathAliases(tree, {
      [`@mma/${ctx.domain.kebab}-domain`]: `packages/${ctx.domain.kebab}-domain/src/index.ts`,
      [`@mma/${ctx.domain.kebab}-domain/infrastructure`]: `packages/${ctx.domain.kebab}-domain/src/infrastructure/index.ts`,
      ...(schema.withContracts ?? true
        ? {
            [`@mma/contracts/${ctx.domain.kebab}`]: `packages/contracts/${ctx.domain.kebab}/src/index.ts`,
          }
        : {}),
    });

    if (tree.exists('.github/service-registry.json')) {
      addDynamoTableEntry(tree, {
        envVar: `${ctx.domain.constantPlural}_DYNAMODB_TABLE_NAME`,
        domain: ctx.domain.kebab,
        gsis:
          ctx.statuses.length > 0
            ? [
                {
                  indexName: 'GSI1',
                  hashKey: 'GSI1PK',
                  hashKeyType: 'S',
                  sortKey: 'GSI1SK',
                  sortKeyType: 'S',
                },
              ]
            : [],
      });
    }

    if (tree.exists('scripts/setup-localstack.ts') && ctx.statuses.length > 0) {
      addLocalstackTable(tree, {
        domainPascal: ctx.domain.pascal,
        domainConstant: ctx.domain.constantPlural,
        tableNameEnvVar: `${ctx.domain.constantPlural}_DYNAMODB_TABLE_NAME`,
        schemaName: `${ctx.entity.pascal}Schema`,
        domainKebab: ctx.domain.kebab,
        gsis: [
          {
            indexName: 'GSI1',
            hashKeyTemplate: `${ctx.entity.constant}#\${${ctx.entity.camel}Status}`,
            sortKeyTemplate: `\${dateCreated}`,
            purpose: `list ${ctx.entity.kebabPlural} by status sorted by dateCreated`,
          },
        ],
      });
    }
  }

  // ── Compose: invoke service + use-case generators ────────────────────
  if ((schema.withService ?? true) && !schema.dryRun) {
    await serviceGenerator(tree, {
      domain: ctx.domain.kebab,
      entity: ctx.entity.kebab,
      persistence: 'dynamodb',
      publishesEvents: schema.publishesEvents === true,
      skipFormat: true,
    });
  }

  if (!schema.dryRun) {
    for (const uc of useCases) {
      const verb = uc === 'get-by-id' ? 'get' : uc === 'list' ? 'list' : uc;
      await useCaseGenerator(tree, {
        domain: ctx.domain.kebab,
        entity: ctx.entity.kebab,
        verb,
        type: uc,
        fields: schema.fields,
      });
    }
  }

  // ── TODO.md handoff ───────────────────────────────────────────────────
  if (!schema.dryRun) {
    tree.write(
      `${domainRoot}/TODO.md`,
      renderTodoMd(ctx, useCases, schema.withService ?? true),
    );
  }

  if (!schema.skipFormat && !schema.dryRun && !process.env.JEST_WORKER_ID) {
    await formatFiles(tree);
  }

  if (schema.dryRun) {
    logger.info(
      `\n[@mma/nx-plugin:domain] DRY RUN — would write ${writes.length} files:\n` +
        writes.map((p) => `  • ${p}`).join('\n') +
        '\n',
    );
  } else {
    logger.info(
      `\n[@mma/nx-plugin:domain] Generated ${ctx.domain.kebab} domain (${writes.length} files)\n` +
        `  → packages/${ctx.domain.kebab}-domain/\n` +
        ((schema.withContracts ?? true) ? `  → packages/contracts/${ctx.domain.kebab}/\n` : '') +
        ((schema.withService ?? true) ? `  → apps/${ctx.domain.kebab}/${ctx.domain.kebab}-api-service/\n` : '') +
        `  → use cases: ${useCases.join(', ')}\n\n` +
        `Next steps (read TODO.md in the domain package for details):\n` +
        `  1. Run: pnpm install\n` +
        `  2. Add business rules to the entity using the \`domain-business-rules\` skill.\n` +
        `  3. Wire the use cases into apps/${ctx.domain.kebab}/${ctx.domain.kebab}-api-service/src/modules/${ctx.entity.kebab}.module.ts.\n` +
        `  4. Replace the placeholder controller in src/presentation/controllers/${ctx.entity.kebab}.controller.ts with real CRUD endpoints.\n` +
        `  5. Run: pnpm run localstack:setup:force && pnpm nx serve ${ctx.domain.kebab}-api-service\n`,
    );
  }
}

const renderTodoMd = (
  ctx: DomainContext,
  useCases: SupportedUseCase[],
  withService: boolean,
): string => `# TODO — ${ctx.domain.pascal} domain

This domain was scaffolded by \`@mma/nx-plugin:domain\`. The skeleton is
runnable but intentionally minimal. Complete the steps below to deliver
production-ready code.

## 1. Business rules (entity)

Open \`src/domain/entities/${ctx.entity.kebab}.entity.ts\` and add:

- [ ] Validation rules in the \`create()\` factory (throw domain exceptions for invalid input).
- [ ] State-transition methods (e.g. \`activate()\`, \`cancel()\`) that update
      \`${ctx.entity.camel}Status\` and \`updatedAt\`.
- [ ] Guard conditions that throw typed domain exceptions when transitions are illegal.
- [ ] Add new exception classes under \`src/domain/exceptions/\` and export them
      from \`exceptions/index.ts\`.

Use the \`domain-business-rules\` skill (\`.claude/skills/domain-business-rules\`)
for the canonical pattern.

## 2. Repository methods

The skeleton repository implements only \`save\`, \`findById\`${ctx.statuses.length > 0 ? ', and `listByStatus`' : ''}.
If the domain needs additional queries (by email, by foreign key, etc.):

- [ ] Add the abstract method to \`src/application/interfaces/${ctx.entity.kebab}-repository.interface.ts\`.
- [ ] Implement it in \`src/infrastructure/repositories/dynamo-${ctx.entity.kebab}.repository.ts\`.
- [ ] Add a corresponding GSI to \`src/infrastructure/schemas/${ctx.entity.pascal}Schema.ts\`.
- [ ] Update the \`scripts/setup-localstack.ts\` table config and run \`pnpm run localstack:setup:force\`.
- [ ] Update \`.github/service-registry.json\` → \`infrastructure.dynamodbTables\`.

## 3. Contracts (Zod schemas)

Open \`packages/contracts/${ctx.domain.kebab}/src/schemas.ts\` and refine the
auto-generated schemas: add string min/max, regex, range constraints, and
\`Z.iso.datetime()\` for date fields. Use the \`add-contracts\` skill.

## 4. Service wiring${withService ? '' : ' (skipped — re-run with --with-service to scaffold)'}

${
    withService
      ? `Open \`apps/${ctx.domain.kebab}/${ctx.domain.kebab}-api-service/src/modules/${ctx.entity.kebab}.module.ts\`
and uncomment the provider blocks. Add a \`useFactory\` provider for **each**
use case, all injecting \`${ctx.domain.constantPlural}_REPOSITORY\`.

Open \`apps/${ctx.domain.kebab}/${ctx.domain.kebab}-api-service/src/application/services/${ctx.entity.kebab}-application.service.ts\`
and replace the \`ping\` method with real public methods that orchestrate the
generated use cases and call \`this.toDto(entity)\`.

Open \`apps/${ctx.domain.kebab}/${ctx.domain.kebab}-api-service/src/presentation/controllers/${ctx.entity.kebab}.controller.ts\`
and replace the placeholder \`ping\` endpoint with the real REST routes.
Use the \`add-api-endpoints\` and \`swagger-controller-docs\` skills.

Open \`apps/${ctx.domain.kebab}/${ctx.domain.kebab}-api-service/src/presentation/filters/domain-exception.filter.ts\`
and add every domain exception to \`DOMAIN_ERROR_MAP\`.`
      : 'Service scaffold was skipped.'
  }

## 5. Use cases generated

The following use cases were scaffolded under
\`packages/${ctx.domain.kebab}-domain/src/application/use-cases/\`:

${useCases.map((u) => `  - [ ] **${u}** — fill in TODO blocks (input fields / entity method calls).`).join('\n')}

Run \`pnpm nx test ${ctx.domain.kebab}-domain\` and replace each use case's
placeholder spec with behavioural tests covering the happy path + every
error branch.

## 6. Tests

- [ ] Domain entity tests (\`*.entity.spec.ts\`) — every business method, every guard.
- [ ] Use case tests — happy + error paths, with mocked repositories.
- [ ] Application service tests — DTO transformation, cursor routing, event publishing.
- [ ] (Optional) Integration tests against LocalStack — see existing \`*.integration.spec.ts\` patterns.

Coverage targets: 80% (domain), 70% (service).

## 7. API E2E project

A new HTTP API service ALWAYS needs a paired \`-e2e\` project:

- [ ] Create \`apps/{domain}/{domain}-api-service-e2e/\` using
      \`.claude/skills/write-api-e2e-tests/SKILL.md\`.
- [ ] Update \`scripts/setup-e2e.ts\` and \`scripts/teardown-e2e.ts\` per
      \`.claude/skills/e2e-infrastructure/SKILL.md\`.
- [ ] Add at least one CRUD spec covering happy path + one validation/error case.

## 8. Deployment

When ready to deploy, follow \`.claude/skills/cd-register-service/SKILL.md\` to
verify the service-registry.json entry, env vars, and any RDS/SQS resources.
`;
