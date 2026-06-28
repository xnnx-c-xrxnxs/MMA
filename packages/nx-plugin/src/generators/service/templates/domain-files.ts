import { buildDomainNames } from '../../lib';

interface Names {
  domain: ReturnType<typeof buildDomainNames>;
  entity: ReturnType<typeof buildDomainNames>;
  /** "user-api-service" */
  serviceName: string;
  /** "USER" */
  envPrefix: string;
  /** "user" — used in config strings, urls etc. */
  domainSlug: string;
}

export const buildNames = (domainName: string, entityName?: string): Names => {
  const domain = buildDomainNames(domainName);
  const entity = buildDomainNames(entityName ?? domainName);
  return {
    domain,
    entity,
    serviceName: `${domain.kebab}-api-service`,
    envPrefix: domain.constantPlural,
    domainSlug: domain.kebab,
  };
};

export const renderMain = (n: Names): string => `import { initTelemetry, correlationMiddleware } from '@mma/telemetry';
initTelemetry('${n.serviceName}');

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { DomainExceptionFilter } from './presentation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(correlationMiddleware());
  app.enableCors({
    origin: process.env.FE_BASE_URL || 'http://localhost:4200',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new DomainExceptionFilter());

  if (process.env.STAGE === 'local' || process.env.SWAGGER_ENABLED === 'true') {
    const builder = new DocumentBuilder()
      .setTitle(\`${n.serviceName.toUpperCase()} [\${process.env.STAGE ?? 'local'}]\`)
      .setDescription('${n.serviceName.toUpperCase()} API')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'JWT', description: 'Enter JWT token', in: 'header' },
        'JWT-auth',
      );

    // In deployed environments the API Gateway routes traffic to this Lambda
    // under /\${DOMAIN_PREFIX}, and Lambda Web Adapter strips that prefix
    // before forwarding to NestJS. Without addServer(), the Swagger UI's
    // "Try it out" button would call /api/... directly and miss the gateway
    // prefix → 404. DOMAIN_PREFIX is injected by Terraform; unset locally.
    if (process.env.DOMAIN_PREFIX) {
      builder.addServer(\`/\${process.env.DOMAIN_PREFIX}\`);
    }

    const document = SwaggerModule.createDocument(app, builder.build());
    SwaggerModule.setup('swagger', app, document, { useGlobalPrefix: true });
  }

  const port = process.env.${n.domain.constant}_SERVICE_PORT || 8080;
  await app.listen(port);
  Logger.log(\`🚀 ${n.serviceName.toUpperCase()} is running on: http://localhost:\${port}/api\`);
}

bootstrap();
`;

export const renderAppModule = (n: Names): string => `import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../presentation/guards/jwt-auth.guard';
import { ${n.entity.pascal}Module } from '../modules/${n.entity.kebab}.module';
import { AppController } from './app.controller';

@Module({
  imports: [${n.entity.pascal}Module],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
`;

export const renderDomainModule = (n: Names): string => `import { Module } from '@nestjs/common';
// TODO: import use cases + repository interface from @mma/${n.domain.kebab}-domain
// import { I${n.entity.pascal}Repository } from '@mma/${n.domain.kebab}-domain';
// TODO: import schema + repository implementation from @mma/${n.domain.kebab}-domain/infrastructure
// import { Dynamo${n.entity.pascal}Repository, ${n.entity.pascal}Schema } from '@mma/${n.domain.kebab}-domain/infrastructure';
// import { Table } from 'dynamodb-onetable';
// import { DynamoDBConfig } from '../infrastructure/config/dynamodb.config';
import { ${n.entity.pascal}ApplicationService } from '../application/services/${n.entity.kebab}-application.service';
import { ${n.entity.pascal}Controller } from '../presentation/controllers/${n.entity.kebab}.controller';

const DYNAMO_TABLE = 'DYNAMO_TABLE';
// const ${n.envPrefix}_REPOSITORY = '${n.envPrefix}_REPOSITORY';

@Module({
  controllers: [${n.entity.pascal}Controller],
  providers: [
    // {
    //   provide: DYNAMO_TABLE,
    //   useFactory: () =>
    //     DynamoDBConfig.getTable(
    //       process.env.${n.envPrefix}_DYNAMODB_TABLE_NAME || 'OldSTTable',
    //       ${n.entity.pascal}Schema,
    //     ),
    // },
    // {
    //   provide: ${n.envPrefix}_REPOSITORY,
    //   useFactory: (table: Table) => new Dynamo${n.entity.pascal}Repository(table),
    //   inject: [DYNAMO_TABLE],
    // },
    // TODO: register one provider per use case (factory injecting ${n.envPrefix}_REPOSITORY)
    ${n.entity.pascal}ApplicationService,
  ],
  exports: [${n.entity.pascal}ApplicationService],
})
export class ${n.entity.pascal}Module {}
`;

export const renderApplicationService = (n: Names): string => `import { Injectable } from '@nestjs/common';
import { createLogger } from '@mma/telemetry';

const logger = createLogger('${n.serviceName}');

/**
 * ${n.entity.pascal} Application Service
 *
 * Orchestrates use cases and transforms domain entities to API DTOs.
 *
 * NOTE: This is a skeleton produced by the service generator.
 * Use the \`domain\` generator (or wire use cases manually) to fill in
 * constructor-injected use cases and DTO transformation methods.
 */
@Injectable()
export class ${n.entity.pascal}ApplicationService {
  // TODO: inject use cases via constructor, e.g.
  //   constructor(
  //     private readonly create${n.entity.pascal}UseCase: Create${n.entity.pascal}UseCase,
  //     private readonly get${n.entity.pascal}ByIdUseCase: Get${n.entity.pascal}ByIdUseCase,
  //   ) {}

  // TODO: implement public methods invoked by the controller, e.g.
  //   async create(input: Create${n.entity.pascal}Input): Promise<${n.entity.pascal}Response> {
  //     logger.info('Creating ${n.entity.camel}', { ... });
  //     const ${n.entity.camel} = await this.create${n.entity.pascal}UseCase.execute(input);
  //     return this.toDto(${n.entity.camel});
  //   }

  ping(): { service: string } {
    logger.info('${n.entity.pascal}ApplicationService ping');
    return { service: '${n.serviceName}' };
  }
}
`;

export const renderApplicationServiceSpec = (n: Names): string => `import { ${n.entity.pascal}ApplicationService } from './${n.entity.kebab}-application.service';

describe('${n.entity.pascal}ApplicationService', () => {
  it('responds to ping', () => {
    expect(new ${n.entity.pascal}ApplicationService().ping()).toEqual({ service: '${n.serviceName}' });
  });
});
`;

export const renderController = (n: Names): string => `// NOTE: Every @Body / @Query / @Param MUST have a matching @ApiBody / @ApiQuery /
// @ApiParam decorator with an explicit
// \`schema: { type: 'object' as const, properties: {...}, required: [...] }\` block.
// Without this, Swagger UI's "Try it out" panel renders NO input fields — only
// the Execute button — because Zod-inferred types are erased at runtime and
// NestJS reflection sees \`@Body() body: ${n.entity.pascal}Input\` as \`Object\`.
// Enforced by the \`swagger-decorators-required\` lint check in scripts/lint-standards.ts.
import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ${n.entity.pascal}ApplicationService } from '../../application/services/${n.entity.kebab}-application.service';

@ApiTags('${n.entity.kebabPlural}')
@Controller('${n.entity.kebabPlural}')
export class ${n.entity.pascal}Controller {
  constructor(private readonly service: ${n.entity.pascal}ApplicationService) {}

  // TODO: replace this placeholder with real CRUD/action endpoints.
  // See add-api-endpoints + swagger-controller-docs skills.

  @Get('ping')
  @ApiOperation({
    summary: 'Health check for ${n.serviceName}',
    description: 'Returns the service name. Used by tests and smoke checks.',
  })
  @ApiOkResponse({
    description: 'Service is reachable.',
    schema: {
      type: 'object' as const,
      properties: { service: { type: 'string', example: '${n.serviceName}' } },
      required: ['service'],
    },
  })
  ping() {
    return this.service.ping();
  }

  // Example: documented create endpoint. Replace with your real use case.
  // @Post()
  // @ApiOperation({ summary: 'Create a new ${n.entity.camel}' })
  // @ApiBody({
  //   description: 'Fields required to create a ${n.entity.camel}.',
  //   schema: {
  //     type: 'object' as const,
  //     properties: {
  //       name: { type: 'string', example: 'Sample ${n.entity.pascal}' },
  //     },
  //     required: ['name'],
  //   },
  // })
  // @ApiCreatedResponse({
  //   description: '${n.entity.pascal} created.',
  //   schema: {
  //     type: 'object' as const,
  //     properties: {
  //       id: { type: 'string', format: 'uuid' },
  //       name: { type: 'string' },
  //     },
  //     required: ['id', 'name'],
  //   },
  // })
  // @ApiBadRequestResponse({ description: 'Validation error.' })
  // async create(@Body() body: { name: string }) {
  //   // delegate to this.service.create(body)
  //   return { id: 'todo', name: body.name };
  // }
}
`;

export const renderControllerSpec = (n: Names): string => `import { ${n.entity.pascal}Controller } from './${n.entity.kebab}.controller';
import { ${n.entity.pascal}ApplicationService } from '../../application/services/${n.entity.kebab}-application.service';

describe('${n.entity.pascal}Controller', () => {
  it('delegates ping to the application service', () => {
    const service = new ${n.entity.pascal}ApplicationService();
    const controller = new ${n.entity.pascal}Controller(service);
    expect(controller.ping()).toEqual({ service: '${n.serviceName}' });
  });
});
`;

export const renderDomainExceptionFilter = (n: Names): string => `import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createLogger } from '@mma/telemetry';
import { Response } from 'express';

const logger = createLogger('${n.serviceName}');

type ErrorConstructor = new (...args: never[]) => Error;

// TODO: import domain + application exceptions from @mma/${n.domain.kebab}-domain
// and add them to the map below with their HTTP status codes.
const DOMAIN_ERROR_MAP: Array<[ErrorConstructor, number]> = [
  // [${n.entity.pascal}NotFoundError, 404],
  // [InvalidInputError, 400],
];

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (status >= 500) {
        logger.error(\`[\${exception.constructor.name}] \${status}\`, {}, exception);
      } else {
        logger.warn(\`[\${exception.constructor.name}] \${status}\`, { body: JSON.stringify(res) });
      }
      response.status(status).json(
        typeof res === 'string'
          ? { statusCode: status, error: exception.constructor.name, message: res }
          : res,
      );
      return;
    }

    if (exception instanceof Error) {
      for (const [ErrorClass, statusCode] of DOMAIN_ERROR_MAP) {
        if (exception instanceof ErrorClass) {
          logger.warn(\`[\${exception.constructor.name}] \${exception.message}\`, { statusCode });
          response.status(statusCode).json({
            statusCode,
            error: exception.constructor.name,
            message: exception.message,
          });
          return;
        }
      }
    }

    const errorName =
      exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);

    logger.error(\`[\${errorName}] \${errorMessage}\`, {}, exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: errorName,
      message: errorMessage,
    });
  }
}
`;

export const renderPresentationBarrel = (n: Names): string => `export * from './controllers/${n.entity.kebab}.controller';
export * from './pipes/zod-validation.pipe';
export * from './filters/domain-exception.filter';
`;

export const renderProjectJson = (n: Names): string => {
  const distPath = `dist/apps/${n.domain.kebab}/${n.serviceName}`;
  return JSON.stringify(
    {
      name: n.serviceName,
      $schema: '../../../node_modules/nx/schemas/project-schema.json',
      sourceRoot: `apps/${n.domain.kebab}/${n.serviceName}/src`,
      projectType: 'application',
      tags: [`scope:${n.domain.kebab}`, 'type:app', 'type:api-service'],
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
            production: { buildTarget: `${n.serviceName}:build:production` },
          },
        },
        test: { options: { passWithNoTests: true } },
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
      references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.spec.json' }],
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
      exclude: ['jest.config.ts', 'jest.config.cts', 'src/**/*.spec.ts', 'src/**/*.test.ts'],
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
