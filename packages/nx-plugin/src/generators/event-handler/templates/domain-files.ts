import { buildDomainNames, DomainNames } from '../../lib';

export interface EventTypeNames {
  /** "USER_DELETED" */
  constant: string;
  /** "user-deleted" */
  kebab: string;
  /** "UserDeleted" */
  pascal: string;
  /** "userDeleted" */
  camel: string;
  /** "user-deleted.handler.ts" — file name */
  fileName: string;
  /** "UserDeletedHandler" — class name */
  className: string;
}

export interface Names {
  domain: DomainNames;
  entity: DomainNames;
  /** "user-event-handler-service" */
  serviceName: string;
  /** "USERS" — env-prefix (constant plural). */
  envPrefix: string;
  /** "user" — used in URLs / config strings. */
  domainSlug: string;
  /** Source domain (set when crossDomain=true; otherwise === domain). */
  sourceDomain: DomainNames;
  /** True when consuming events from a different bounded context. */
  crossDomain: boolean;
  /** Parsed list of event types. */
  eventTypes: EventTypeNames[];
}

const constantToWords = (constant: string): string[] =>
  constant.toLowerCase().split('_').filter(Boolean);

export const buildEventTypeNames = (constant: string): EventTypeNames => {
  const trimmed = constant.trim();
  if (!/^[A-Z][A-Z0-9_]*$/.test(trimmed)) {
    throw new Error(
      `event-handler: invalid event type '${trimmed}'. Must be CONSTANT_CASE (e.g. USER_DELETED).`,
    );
  }
  const words = constantToWords(trimmed);
  const kebab = words.join('-');
  const pascal = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  const camel =
    words[0] +
    words
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
  return {
    constant: trimmed,
    kebab,
    pascal,
    camel,
    fileName: `${kebab}.handler.ts`,
    className: `${pascal}Handler`,
  };
};

export const buildNames = (
  domainName: string,
  entityName?: string,
  options: { crossDomain?: boolean; sourceDomain?: string; eventTypes?: string } = {},
): Names => {
  const domain = buildDomainNames(domainName);
  const entity = buildDomainNames(entityName ?? domainName);
  const crossDomain = options.crossDomain === true;
  const sourceDomain = crossDomain
    ? buildDomainNames(options.sourceDomain ?? domainName)
    : domain;

  const rawEventTypes = (options.eventTypes ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawEventTypes.length === 0) {
    throw new Error(
      `event-handler: at least one event type must be supplied (got '${options.eventTypes ?? ''}').`,
    );
  }

  const eventTypes = rawEventTypes.map(buildEventTypeNames);

  return {
    domain,
    entity,
    serviceName: `${domain.kebab}-event-handler-service`,
    envPrefix: domain.constantPlural,
    domainSlug: domain.kebab,
    sourceDomain,
    crossDomain,
    eventTypes,
  };
};

// ─── main.ts ──────────────────────────────────────────────────────────────────

export const renderMain = (n: Names): string => `import { initTelemetry } from '@mma/telemetry';
initTelemetry('${n.serviceName}');

import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Context, SQSRecord } from 'aws-lambda';
import { AppModule } from './app/app.module';
import { ${n.entity.pascal}EventHandlerService } from './application/services/${n.entity.kebab}-event-handler.service';
import { SqsLocalService } from './infrastructure/sqs/sqs-local.service';
import { NormalizedSqsRecord } from './application/interfaces/normalized-sqs-record.interface';

// Cached NestJS application context (warm Lambda re-use)
let cachedApp: INestApplicationContext | undefined;

async function bootstrap(): Promise<INestApplicationContext> {
  if (!cachedApp) {
    cachedApp = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn'],
    });
  }
  return cachedApp;
}

// Local development — poll LocalStack SQS
if (process.env.STAGE === 'local') {
  setImmediate(async () => {
    const app = await bootstrap();
    const sqsLocalService = app.get(SqsLocalService);
    Logger.log('Starting local SQS polling...', '${n.entity.pascal}EventHandlerService');
    sqsLocalService.pollQueue();
  });
}

// AWS Lambda handler
export const handler = async (
  event: { Records: SQSRecord[] },
  _context: Context,
) => {
  const app = await bootstrap();
  const eventHandlerService = app.get(${n.entity.pascal}EventHandlerService);

  const records: NormalizedSqsRecord[] = event.Records.map((r) => ({
    body: r.body,
    messageId: r.messageId,
    receiptHandle: r.receiptHandle,
    messageAttributes: r.messageAttributes as unknown as Record<
      string,
      { DataType: string; StringValue?: string }
    >,
  }));

  await eventHandlerService.handleRecords(records);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Records processed successfully' }),
  };
};
`;

// ─── app/app.module.ts ────────────────────────────────────────────────────────

export const renderAppModule = (n: Names): string => `import { Module } from '@nestjs/common';
import { ${n.entity.pascal}Module } from '../modules/${n.entity.kebab}.module';

@Module({
  imports: [${n.entity.pascal}Module],
})
export class AppModule {}
`;

// ─── modules/{entity}.module.ts ───────────────────────────────────────────────

export const renderDomainModule = (n: Names): string => {
  const handlerImports = n.eventTypes
    .map((e) => e.className)
    .join(', ');
  return `import { Module } from '@nestjs/common';
import { ${n.entity.pascal}EventHandlerService } from '../application/services/${n.entity.kebab}-event-handler.service';
import { ${handlerImports} } from '../application/services/handlers';
import { SqsLocalService } from '../infrastructure/sqs/sqs-local.service';

/**
 * ${n.entity.pascal}Module (${n.serviceName})
 *
 * Wires the event dispatcher, per-event handlers, and the local SQS polling service.
 *
 * - No \`controllers\` array — this service has no HTTP layer.
 * - Add one plain class provider per new event handler.
${n.crossDomain ? ` * - Cross-domain consumer: schemas come from @mma/contracts/${n.sourceDomain.kebab}.\n` : ''} */
@Module({
  providers: [
    // Per-event handlers (one entry per event type)
${n.eventTypes.map((e) => `    ${e.className},`).join('\n')}

    // Event dispatcher
    ${n.entity.pascal}EventHandlerService,

    // Local polling (STAGE=local only — no-op in Lambda)
    SqsLocalService,
  ],
  exports: [${n.entity.pascal}EventHandlerService],
})
export class ${n.entity.pascal}Module {}
`;
};

// ─── application/services/{entity}-event-handler.service.ts ────────────────

export const renderDispatcher = (n: Names): string => {
  const schemaSource = n.sourceDomain;
  const schemaIdentifier = `${schemaSource.camel}DomainEventSchema`;
  const enumIdentifier = `${schemaSource.pascal}EventTypeEnum`;
  const handlerImports = n.eventTypes.map((e) => e.className).join(', ');
  const cases = n.eventTypes
    .map(
      (e) => `        case ${enumIdentifier}.${e.constant}:
          await this.${camelLower(e.className)}.handle(payload, record.messageId);
          break;`,
    )
    .join('\n');
  const ctorParams = n.eventTypes
    .map(
      (e) => `    private readonly ${camelLower(e.className)}: ${e.className},`,
    )
    .join('\n');

  return `import { Injectable } from '@nestjs/common';
import { createLogger, extractTraceContext, otelContext, runWithCorrelationId } from '@mma/telemetry';
import { ${schemaIdentifier}, ${enumIdentifier} } from '@mma/contracts/${schemaSource.kebab}';
import { NormalizedSqsRecord } from '../interfaces/normalized-sqs-record.interface';
import { ${handlerImports} } from './handlers';

const logger = createLogger('${n.serviceName}');

/**
 * ${n.entity.pascal}EventHandlerService
 *
 * Thin dispatcher — parses the SQS message body, validates the event shape
 * against the Zod discriminated union, and routes each event to its dedicated
 * per-event handler.
 *
 * Rules:
 *   - Zero event logic in this file — every \`case\` is a single handler.handle() call.
 *   - safeParse (not parse) — invalid bodies are logged and skipped.
 *   - Handler errors are rethrown so SqsLocalService skips DeleteMessageCommand.
 *   - Adding a new event: create a handler -> add to handlers/index.ts -> add one case here.
${n.crossDomain ? ` *   - CROSS-DOMAIN consumer: imports event schemas from @mma/contracts/${schemaSource.kebab} only.\n` : ''} */
@Injectable()
export class ${n.entity.pascal}EventHandlerService {
  constructor(
${ctorParams}
  ) {}

  /**
   * Entry point for both local SQS polling and Lambda execution.
   * Processes each record independently — a failure on one record does not abort the batch.
   */
  async handleRecords(records: NormalizedSqsRecord[]): Promise<void> {
    for (const record of records) {
      const ctx = extractTraceContext(record.messageAttributes ?? {});
      let correlationId: string | undefined;
      try {
        const raw = JSON.parse(record.body);
        correlationId = typeof raw.correlationId === 'string' ? raw.correlationId : undefined;
      } catch { /* body parse handled in processRecord */ }

      const process = () => this.processRecord(record);
      await otelContext.with(ctx, () =>
        correlationId ? runWithCorrelationId(correlationId, process) : process()
      );
    }
  }

  private async processRecord(record: NormalizedSqsRecord): Promise<void> {
    const parseResult = ${schemaIdentifier}.safeParse(JSON.parse(record.body));

    if (!parseResult.success) {
      logger.error('Invalid event shape — skipping message', { messageId: record.messageId ?? '(no id)' }, parseResult.error);
      return;
    }

    const payload = parseResult.data;
    logger.info('Dispatching event', { eventType: payload.eventType, messageId: record.messageId ?? '(no id)' });

    try {
      switch (payload.eventType) {
${cases}

        default: {
          const unhandledEvent = payload as unknown as { eventType: string };
          logger.warn('Unhandled event type', { eventType: unhandledEvent.eventType, messageId: record.messageId ?? '(no id)' });
        }
      }

      logger.info('Event dispatched successfully', { eventType: payload.eventType, messageId: record.messageId ?? '(no id)' });
    } catch (error) {
      logger.error('Failed to dispatch event', { eventType: payload.eventType, messageId: record.messageId ?? '(no id)' }, error);
      throw error;
    }
  }
}
`;
};

const camelLower = (className: string): string =>
  className.charAt(0).toLowerCase() + className.slice(1);

// ─── application/services/handlers/{event-kebab}.handler.ts ────────────────

export const renderEventHandlerStub = (
  n: Names,
  evt: EventTypeNames,
): string => {
  const sourceDomainEventType = `${n.sourceDomain.pascal}DomainEvent`;
  const payloadTypeName = `${evt.pascal}Payload`;

  if (n.crossDomain) {
    // Cross-domain: derive the payload type from the contracts discriminated union.
    return `import { Injectable } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';
import type { ${sourceDomainEventType} } from '@mma/contracts/${n.sourceDomain.kebab}';
import { IEventHandler } from '../../interfaces/event-handler.interface';

const logger = createLogger('${n.serviceName}');

type ${payloadTypeName} = Extract<${sourceDomainEventType}, { eventType: '${evt.constant}' }>;

/**
 * ${evt.className}
 *
 * Handles the ${evt.constant} SQS event (cross-domain — published by ${n.sourceDomain.kebab}).
 *
 * TODO: Inject the use cases needed to react to this event in this service's
 *       module. Add idempotency guards if this is part of a saga (see the
 *       \`choreography-saga\` skill).
 */
@Injectable()
export class ${evt.className} implements IEventHandler<${payloadTypeName}> {
  async handle(payload: ${payloadTypeName}, messageId?: string): Promise<void> {
    logger.info('Handling ${evt.constant} event', { messageId: messageId ?? '(no id)' });

    // ─── TODO: implement reaction logic ────────────────────────────────────
    // 1. Inject required use cases via the constructor.
    // 2. Call the use case with fields from \`payload\`.
    // 3. For sagas: catch domain exceptions when the entity is already in
    //    a terminal state, log, and return (idempotency).
    // ────────────────────────────────────────────────────────────────────────

    void payload;
  }
}
`;
  }

  // Same-domain: payload type comes from the domain package.
  return `import { Injectable } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';
import type { ${payloadTypeName} } from '@mma/${n.sourceDomain.kebab}-domain';
import { IEventHandler } from '../../interfaces/event-handler.interface';

const logger = createLogger('${n.serviceName}');

/**
 * ${evt.className}
 *
 * Handles the ${evt.constant} SQS event.
 *
 * TODO: Inject the use cases needed to react to this event in this service's
 *       module and replace this stub with the real reaction logic.
 */
@Injectable()
export class ${evt.className} implements IEventHandler<${payloadTypeName}> {
  async handle(payload: ${payloadTypeName}, messageId?: string): Promise<void> {
    logger.info('Handling ${evt.constant} event', { messageId: messageId ?? '(no id)' });

    // ─── TODO: implement reaction logic ────────────────────────────────────
    // 1. Inject required use cases via the constructor.
    // 2. Call the use case with fields from \`payload\`.
    // ────────────────────────────────────────────────────────────────────────

    void payload;
  }
}
`;
};

export const renderHandlersBarrel = (n: Names): string =>
  n.eventTypes.map((e) => `export * from './${e.kebab}.handler';`).join('\n') +
  '\n';

// ─── infrastructure/sqs/sqs-local.service.ts ───────────────────────────────

export const renderSqsLocalService = (n: Names): string => `import { Injectable } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { NormalizedSqsRecord } from '../../application/interfaces/normalized-sqs-record.interface';
import { ${n.entity.pascal}EventHandlerService } from '../../application/services/${n.entity.kebab}-event-handler.service';

const logger = createLogger('${n.serviceName}');

/**
 * SqsLocalService
 *
 * Polls LocalStack SQS and delegates to ${n.entity.pascal}EventHandlerService.
 * Used ONLY when STAGE=local — replaced by the Lambda handler in production.
 *
 * Delete-on-success: DeleteMessageCommand is sent only after successful processing.
 * If processing throws, the message remains in the queue and reappears after the
 * visibility timeout.
 */
@Injectable()
export class SqsLocalService {
  private readonly sqsClient = new SQSClient({
    region: process.env.DEFAULT_REGION || 'us-east-1',
    endpoint: process.env.LOCALSTACK_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  });

  constructor(
    private readonly eventHandlerService: ${n.entity.pascal}EventHandlerService,
  ) {}

  async pollQueue(): Promise<void> {
    const queueUrl = process.env.${n.envPrefix}_SQS_QUEUE_URL;
    if (!queueUrl) {
      throw new Error('${n.envPrefix}_SQS_QUEUE_URL is not defined');
    }
    logger.info('Polling queue', { queueUrl });

    while (true) {
      try {
        const { Messages } = await this.sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
            MessageAttributeNames: ['All'],
          }),
        );

        if (Messages && Messages.length > 0) {
          for (const message of Messages) {
            await this.processMessage(message, queueUrl);
          }
        }
      } catch (error) {
        logger.error('Error polling SQS queue', {}, error);
      }

      await new Promise((r) => setImmediate(r));
    }
  }

  private async processMessage(message: Message, queueUrl: string): Promise<void> {
    const normalized: NormalizedSqsRecord = {
      body: message.Body ?? '',
      messageId: message.MessageId,
      receiptHandle: message.ReceiptHandle,
      messageAttributes: message.MessageAttributes as unknown as Record<
        string,
        { DataType: string; StringValue?: string }
      >,
    };

    logger.info('Processing message', { messageId: normalized.messageId ?? '(no id)' });

    await this.eventHandlerService.handleRecords([normalized]);

    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }
}
`;

// ─── project.json + tsconfig + jest + webpack ─────────────────────────────────

export const renderProjectJson = (n: Names): string => {
  const distPath = `dist/apps/${n.domain.kebab}/${n.serviceName}`;
  return JSON.stringify(
    {
      name: n.serviceName,
      $schema: '../../../node_modules/nx/schemas/project-schema.json',
      sourceRoot: `apps/${n.domain.kebab}/${n.serviceName}/src`,
      projectType: 'application',
      tags: [`scope:${n.domain.kebab}`, 'type:app', 'type:event-handler'],
      targets: {
        build: {
          executor: 'nx:run-commands',
          options: {
            command: 'webpack-cli build',
            args: ['--node-env=production'],
            cwd: `apps/${n.domain.kebab}/${n.serviceName}`,
          },
          configurations: {
            development: { args: ['--node-env=development'] },
          },
        },
        'prune-lockfile': {
          dependsOn: ['build'],
          cache: true,
          executor: '@nx/js:prune-lockfile',
          outputs: [
            `{workspaceRoot}/${distPath}/package.json`,
            `{workspaceRoot}/${distPath}/pnpm-lock.yaml`,
          ],
          options: { buildTarget: 'build' },
        },
        'copy-workspace-modules': {
          dependsOn: ['build'],
          cache: true,
          outputs: [`{workspaceRoot}/${distPath}/workspace_modules`],
          executor: '@nx/js:copy-workspace-modules',
          options: { buildTarget: 'build' },
        },
        prune: {
          dependsOn: ['prune-lockfile', 'copy-workspace-modules'],
          executor: 'nx:noop',
        },
        serve: {
          continuous: true,
          executor: '@nx/js:node',
          defaultConfiguration: 'development',
          dependsOn: ['build'],
          options: {
            buildTarget: `${n.serviceName}:build`,
            runBuildTargetDependencies: false,
          },
          configurations: {
            development: { buildTarget: `${n.serviceName}:build:development` },
          },
        },
        test: {
          executor: '@nx/jest:jest',
          outputs: [`{workspaceRoot}/coverage/apps/${n.domain.kebab}/${n.serviceName}`],
          options: {
            jestConfig: `apps/${n.domain.kebab}/${n.serviceName}/jest.config.cts`,
            passWithNoTests: true,
          },
        },
        lint: { executor: '@nx/eslint:lint' },
      },
    },
    null,
    2,
  );
};

export const renderTsconfigBase = (): string =>
  JSON.stringify(
    {
      extends: '../../../tsconfig.base.json',
      files: [],
      include: [],
      references: [
        { path: './tsconfig.app.json' },
        { path: './tsconfig.spec.json' },
      ],
      compilerOptions: { esModuleInterop: true },
    },
    null,
    2,
  );

export const renderTsconfigApp = (): string =>
  JSON.stringify(
    {
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: '../../../dist/out-tsc',
        module: 'commonjs',
        types: ['node'],
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        target: 'es2022',
        moduleResolution: 'node',
      },
      include: ['src/**/*.ts'],
      exclude: [
        'jest.config.ts',
        'jest.config.cts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ],
    },
    null,
    2,
  );

export const renderTsconfigSpec = (): string =>
  JSON.stringify(
    {
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: '../../../dist/out-tsc',
        module: 'commonjs',
        moduleResolution: 'node10',
        types: ['jest', 'node'],
      },
      include: [
        'jest.config.ts',
        'jest.config.cts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
      ],
    },
    null,
    2,
  );

export const renderJestConfig = (n: Names): string => `module.exports = {
  displayName: '${n.serviceName}',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/apps/${n.domain.kebab}/${n.serviceName}',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
`;

export const renderWebpackConfig = (n: Names): string => `const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  resolve: {
    alias: {
      '@opentelemetry/api': require.resolve('@opentelemetry/api'),
    },
  },
  output: {
    path: join(__dirname, '../../../dist/apps/${n.domain.kebab}/${n.serviceName}'),
    libraryTarget: 'commonjs2',
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
`;
