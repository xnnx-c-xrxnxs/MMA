import type { Tree } from '@nx/devkit';
import { formatFiles, logger } from '@nx/devkit';
import type { EventHandlerGeneratorSchema } from './schema';
import {
  validateDomainName,
  addEventHandlerServiceEntry,
  addSqsQueueEntry,
  addLocalstackQueue,
  addServeTask,
  appendEnvSection,
  withGeneratedHeader,
} from '../lib';
import { NORMALIZED_SQS_RECORD, EVENT_HANDLER_INTERFACE } from './templates/static-files';
import {
  buildNames,
  renderMain,
  renderAppModule,
  renderDomainModule,
  renderDispatcher,
  renderEventHandlerStub,
  renderHandlersBarrel,
  renderSqsLocalService,
  renderProjectJson,
  renderTsconfigBase,
  renderTsconfigApp,
  renderTsconfigSpec,
  renderJestConfig,
  renderWebpackConfig,
} from './templates/domain-files';

export default async function eventHandlerGenerator(
  tree: Tree,
  schema: EventHandlerGeneratorSchema,
): Promise<void> {
  validateDomainName(schema.domain);
  if (schema.entity) validateDomainName(schema.entity);
  if (schema.crossDomain) {
    if (!schema.sourceDomain) {
      throw new Error(
        `event-handler: 'sourceDomain' is required when crossDomain=true.`,
      );
    }
    validateDomainName(schema.sourceDomain);
  }

  const n = buildNames(schema.domain, schema.entity, {
    crossDomain: schema.crossDomain,
    sourceDomain: schema.sourceDomain,
    eventTypes: schema.eventTypes,
  });
  const root = `apps/${n.domain.kebab}/${n.serviceName}`;

  if (tree.exists(`${root}/project.json`)) {
    throw new Error(
      `event-handler: ${root} already exists. Aborting to avoid overwriting an existing service.`,
    );
  }

  const headerOpts = {
    generator: '@old-st/nx-plugin:event-handler',
    command: `nx g @old-st/nx-plugin:event-handler --domain=${n.domain.kebab}${
      schema.entity ? ` --entity=${n.entity.kebab}` : ''
    } --eventTypes=${n.eventTypes.map((e) => e.constant).join(',')}${
      schema.crossDomain
        ? ` --crossDomain --sourceDomain=${n.sourceDomain.kebab}`
        : ''
    }`,
  };
  const wh = (s: string) => withGeneratedHeader(s, headerOpts);

  // 1. Project metadata
  tree.write(`${root}/project.json`, renderProjectJson(n));
  tree.write(`${root}/tsconfig.json`, renderTsconfigBase());
  tree.write(`${root}/tsconfig.app.json`, renderTsconfigApp());
  tree.write(`${root}/tsconfig.spec.json`, renderTsconfigSpec());
  tree.write(`${root}/jest.config.cts`, renderJestConfig(n));
  tree.write(`${root}/webpack.config.js`, renderWebpackConfig(n));
  tree.write(`${root}/src/assets/.gitkeep`, '');

  // 2. App layer
  tree.write(`${root}/src/main.ts`, wh(renderMain(n)));
  tree.write(`${root}/src/app/app.module.ts`, wh(renderAppModule(n)));

  // 3. Module wiring
  tree.write(
    `${root}/src/modules/${n.entity.kebab}.module.ts`,
    wh(renderDomainModule(n)),
  );

  // 4. Application interfaces
  tree.write(
    `${root}/src/application/interfaces/normalized-sqs-record.interface.ts`,
    wh(NORMALIZED_SQS_RECORD),
  );
  tree.write(
    `${root}/src/application/interfaces/event-handler.interface.ts`,
    wh(EVENT_HANDLER_INTERFACE),
  );

  // 5. Application services — dispatcher + per-event handlers
  tree.write(
    `${root}/src/application/services/${n.entity.kebab}-event-handler.service.ts`,
    wh(renderDispatcher(n)),
  );
  for (const evt of n.eventTypes) {
    tree.write(
      `${root}/src/application/services/handlers/${evt.kebab}.handler.ts`,
      renderEventHandlerStub(n, evt),
    );
  }
  tree.write(
    `${root}/src/application/services/handlers/index.ts`,
    wh(renderHandlersBarrel(n)),
  );

  // 6. Infrastructure — local SQS poller
  tree.write(
    `${root}/src/infrastructure/sqs/sqs-local.service.ts`,
    wh(renderSqsLocalService(n)),
  );

  // 7. Workspace wiring (idempotent updates)
  const queueNameEnvVar = `${n.envPrefix}_SQS_QUEUE_NAME`;
  const queueUrlEnvVar = `${n.envPrefix}_SQS_QUEUE_URL`;
  const queueNameDefault = `${n.domain.kebab}-events`;

  // 7a. service-registry.json — add worker service entry + queue entry
  addEventHandlerServiceEntry(tree, {
    name: n.serviceName,
    distPath: `dist/apps/${n.domain.kebab}/${n.serviceName}`,
    domain: n.domain.kebab,
    type: 'worker',
    handler: 'main.handler',
    memorySize: 512,
    timeout: 30,
    sqsQueueRef: queueNameEnvVar,
    envVars: ['STAGE', queueUrlEnvVar],
  });
  addSqsQueueEntry(tree, {
    envVar: queueNameEnvVar,
    domain: n.domain.kebab,
    fifo: false,
    description: `${n.domain.kebab} domain events queue`,
  });

  // 7b. .env.local.example — append the per-service section (idempotent)
  appendEnvSection(tree, '.env.local.example', `${n.serviceName}`, [
    {
      key: queueUrlEnvVar,
      value: `http://sqs.\${DEFAULT_REGION}.localhost.localstack.cloud:4566/000000000000/${queueNameDefault}`,
    },
    { key: queueNameEnvVar, value: queueNameDefault },
  ]);

  // 7c. scripts/setup-localstack.ts — register the queue (idempotent)
  if (tree.exists('scripts/setup-localstack.ts')) {
    addLocalstackQueue(tree, {
      queueNameEnvVar,
      queueNameDefault,
      description: `${n.domain.kebab} domain events`,
    });
  }

  // 7d. .vscode/tasks.json — register the serve task
  addServeTask(tree, {
    label: `Service: Serve ${n.serviceName}`,
    nxProject: n.serviceName,
    appendToCompoundTasks: ['Services: Start All'],
  });

  if (!schema.skipFormat && !process.env.JEST_WORKER_ID) {
    await formatFiles(tree);
  }

  const eventList = n.eventTypes.map((e) => e.constant).join(', ');
  logger.info(
    `\n[@old-st/nx-plugin:event-handler] Generated ${n.serviceName}\n` +
      `  → ${root}/\n` +
      `  → events: ${eventList}\n` +
      (n.crossDomain
        ? `  → cross-domain consumer of: ${n.sourceDomain.kebab}\n`
        : '') +
      `\nNext steps:\n` +
      `  1. Run: pnpm install\n` +
      `  2. Open each handler in src/application/services/handlers/ and replace the TODO stub with use-case calls.\n` +
      `  3. Wire any required use cases as providers in src/modules/${n.entity.kebab}.module.ts.\n` +
      `  4. Add specs for each handler (skill: write-domain-tests).\n` +
      `  5. Run: pnpm run localstack:setup:force && pnpm nx serve ${n.serviceName}\n`,
  );
}
