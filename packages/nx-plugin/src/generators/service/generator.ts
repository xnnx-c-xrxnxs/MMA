import type { Tree } from '@nx/devkit';
import { formatFiles, logger } from '@nx/devkit';
import type { ServiceGeneratorSchema } from './schema';
import {
  validateDomainName,
  addApiServiceEntry,
  addPublicRoutesForService,
  addServeTask,
  appendEnvSection,
  claimNextPort,
  withGeneratedHeader,
} from '../lib';
import {
  PUBLIC_DECORATOR,
  CURRENT_USER_DECORATOR,
  EXPRESS_DTS,
  ZOD_PIPE,
  ZOD_PIPE_SPEC,
  JWT_CONFIG,
  JWT_AUTH_GUARD,
  DYNAMODB_CONFIG,
  APP_CONTROLLER,
  APP_CONTROLLER_SPEC,
} from './templates/static-files';
import {
  buildNames,
  renderMain,
  renderAppModule,
  renderDomainModule,
  renderApplicationService,
  renderApplicationServiceSpec,
  renderController,
  renderControllerSpec,
  renderDomainExceptionFilter,
  renderPresentationBarrel,
  renderProjectJson,
  renderTsconfigBase,
  renderTsconfigApp,
  renderTsconfigSpec,
  renderJestConfig,
  renderWebpackConfig,
} from './templates/domain-files';

export default async function serviceGenerator(
  tree: Tree,
  schema: ServiceGeneratorSchema,
): Promise<void> {
  validateDomainName(schema.domain);
  if (schema.entity) validateDomainName(schema.entity);

  const persistence = schema.persistence ?? 'dynamodb';
  if (persistence !== 'dynamodb') {
    throw new Error(
      `service generator: persistence='${persistence}' is not yet supported. Use 'dynamodb'.`,
    );
  }

  const n = buildNames(schema.domain, schema.entity);
  const root = `apps/${n.domain.kebab}/${n.serviceName}`;

  if (tree.exists(`${root}/project.json`)) {
    throw new Error(
      `service generator: ${root} already exists. Aborting to avoid overwriting an existing service.`,
    );
  }

  const headerOpts = {
    generator: '@mma/nx-plugin:service',
    command: `nx g @mma/nx-plugin:service --domain=${n.domain.kebab}${
      schema.entity ? ` --entity=${n.entity.kebab}` : ''
    }${schema.publishesEvents ? ' --publishesEvents' : ''}`,
  };
  const wh = (s: string) => withGeneratedHeader(s, headerOpts);

  // 1. Project metadata
  tree.write(`${root}/project.json`, renderProjectJson(n));
  tree.write(`${root}/tsconfig.json`, renderTsconfigBase());
  tree.write(`${root}/tsconfig.app.json`, renderTsconfigApp());
  tree.write(`${root}/tsconfig.spec.json`, renderTsconfigSpec());
  tree.write(`${root}/jest.config.cts`, renderJestConfig(n));
  tree.write(`${root}/webpack.config.js`, renderWebpackConfig(n));
  // Webpack plugin requires this directory to exist for static asset copying,
  // even if no assets are present yet.
  tree.write(`${root}/src/assets/.gitkeep`, '');

  // 2. App layer
  tree.write(`${root}/src/main.ts`, wh(renderMain(n)));
  tree.write(`${root}/src/app/app.module.ts`, wh(renderAppModule(n)));
  tree.write(`${root}/src/app/app.controller.ts`, wh(APP_CONTROLLER));
  tree.write(`${root}/src/app/app.controller.spec.ts`, wh(APP_CONTROLLER_SPEC));

  // 3. Module wiring
  tree.write(`${root}/src/modules/${n.entity.kebab}.module.ts`, wh(renderDomainModule(n)));

  // 4. Application service
  tree.write(
    `${root}/src/application/services/${n.entity.kebab}-application.service.ts`,
    renderApplicationService(n),
  );
  tree.write(
    `${root}/src/application/services/${n.entity.kebab}-application.service.spec.ts`,
    renderApplicationServiceSpec(n),
  );

  // 5. Infrastructure config
  tree.write(`${root}/src/infrastructure/config/jwt.config.ts`, wh(JWT_CONFIG));
  tree.write(`${root}/src/infrastructure/config/dynamodb.config.ts`, wh(DYNAMODB_CONFIG));

  // 6. Presentation layer
  tree.write(`${root}/src/presentation/index.ts`, wh(renderPresentationBarrel(n)));
  tree.write(
    `${root}/src/presentation/controllers/${n.entity.kebab}.controller.ts`,
    renderController(n),
  );
  tree.write(
    `${root}/src/presentation/controllers/${n.entity.kebab}.controller.spec.ts`,
    renderControllerSpec(n),
  );
  tree.write(`${root}/src/presentation/pipes/zod-validation.pipe.ts`, wh(ZOD_PIPE));
  tree.write(`${root}/src/presentation/pipes/zod-validation.pipe.spec.ts`, wh(ZOD_PIPE_SPEC));
  tree.write(
    `${root}/src/presentation/filters/domain-exception.filter.ts`,
    renderDomainExceptionFilter(n),
  );
  tree.write(`${root}/src/presentation/guards/jwt-auth.guard.ts`, wh(JWT_AUTH_GUARD));
  tree.write(`${root}/src/presentation/decorators/public.decorator.ts`, wh(PUBLIC_DECORATOR));
  tree.write(
    `${root}/src/presentation/decorators/current-user.decorator.ts`,
    wh(CURRENT_USER_DECORATOR),
  );
  tree.write(`${root}/src/presentation/types/express.d.ts`, wh(EXPRESS_DTS));

  // 7. Workspace wiring (idempotent updates)
  // (Service apps are not typically imported as libraries; we do not add a path alias for them.
  // Domain packages get aliases added by the domain generator.)

  const publishesEvents = schema.publishesEvents === true;

  // 7a. service-registry.json — add API service entry
  const baseEnvVars = [
    `${n.envPrefix}_DYNAMODB_TABLE_NAME`,
    'AWS_SECRETS_ARN',
    'STAGE',
    'JWT_JWKS_URI',
    'JWT_ISSUER',
    'JWT_USER_ID_CLAIM',
    'JWT_USER_ROLE_CLAIM',
    'FE_BASE_URL',
  ];
  addApiServiceEntry(tree, {
    name: n.serviceName,
    distPath: `dist/apps/${n.domain.kebab}/${n.serviceName}`,
    domain: n.domain.kebab,
    type: 'api',
    handler: 'run.sh',
    memorySize: 512,
    timeout: 30,
    envVars: publishesEvents
      ? [...baseEnvVars, `${n.envPrefix}_SQS_QUEUE_URL`]
      : baseEnvVars,
  });

  // 7a-ii. service-registry.json — seed standard public routes (health + swagger trio).
  // These match the @Public() decorators in the generated AppController and the
  // gateway-public-routes-sync lint check (which subtracts the 3 swagger routes
  // as a fixed allowance). Without these entries, lint fails on the first run.
  addPublicRoutesForService(tree, n.serviceName);

  // 7b. .env.local.example — append the per-service section
  const port = claimNextPort(tree);
  const envEntries = [
    { key: `${n.domain.constant}_SERVICE_PORT`, value: String(port) },
    { key: `API_${n.domain.constant}_URL`, value: `http://localhost:${port}/api` },
    { key: `NEXT_PUBLIC_API_${n.domain.constant}_URL`, value: `http://localhost:${port}/api` },
    { key: `${n.envPrefix}_DYNAMODB_TABLE_NAME`, value: 'OldSTTable' },
  ];
  if (publishesEvents) {
    envEntries.push(
      { key: `${n.envPrefix}_SQS_QUEUE_URL`, value: '' },
      { key: `${n.envPrefix}_SQS_QUEUE_NAME`, value: `${n.domain.kebab}-events` },
    );
  }
  appendEnvSection(tree, '.env.local.example', `${n.serviceName} (port ${port})`, envEntries);

  // 7c. .vscode/tasks.json — register the serve task
  addServeTask(tree, {
    label: `Service: Serve ${n.serviceName}`,
    nxProject: n.serviceName,
    appendToCompoundTasks: ['Services: Start All'],
  });

  if (!schema.skipFormat && !process.env.JEST_WORKER_ID) {
    await formatFiles(tree);
  }

  logger.info(
    `\n[@mma/nx-plugin:service] Generated ${n.serviceName}\n` +
      `  → ${root}/\n` +
      `  → port: ${port}\n\n` +
      `Next steps:\n` +
      `  1. Implement domain entity + repository in packages/${n.domain.kebab}-domain (use the \`domain\` generator).\n` +
      `  2. Uncomment the provider block in src/modules/${n.entity.kebab}.module.ts and wire your use cases.\n` +
      `  3. Add domain exceptions to src/presentation/filters/domain-exception.filter.ts.\n` +
      `  4. Replace the placeholder ping endpoint in src/presentation/controllers/${n.entity.kebab}.controller.ts.\n` +
      `  5. Run: pnpm nx serve ${n.serviceName}\n`,
  );
}
