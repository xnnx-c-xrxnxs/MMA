// user-api-service uses Lambda Web Adapter in deployed environments.
// Single-mode HTTP server — works identically locally and in Lambda.
// The adapter layer intercepts requests and translates them to/from
// the Lambda invocation event format. Domain prefix stripping is handled
// by AWS_LWA_REMOVE_BASE_PATH env var set in Terraform.
import { initTelemetry, correlationMiddleware } from '@old-st/telemetry';
initTelemetry('user-api-service');

import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DomainExceptionFilter } from './presentation';
import { HttpLoggingInterceptor } from './presentation/interceptors/http-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.use(correlationMiddleware());
  app.enableCors({
    origin: process.env.FE_BASE_URL || 'http://localhost:4200',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  // Swagger is gated per-environment. Always on locally; in deployed environments
  // it is enabled only when SWAGGER_ENABLED=true. The /api/swagger and
  // /api/swagger-json paths must also appear in service-registry.json →
  // gatewayAuth.publicRoutes so the gateway JWT authorizer does not block them.
  if (process.env.STAGE === 'local' || process.env.SWAGGER_ENABLED === 'true') {
    // Lazy require — keeps @nestjs/swagger out of the cold-start parse path
    // when SWAGGER_ENABLED is not set in deployed environments.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle(`USER-API-SERVICE [${process.env.STAGE ?? 'local'}]`)
      .setDescription('USER-API-SERVICE API')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'JWT', description: 'Enter JWT token', in: 'header' },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document, { useGlobalPrefix: true });
  }

  const port = process.env.USER_SERVICE_PORT || 8080;
  await app.listen(port);
  Logger.log(`🚀 USER-API-SERVICE is running on: http://localhost:${port}/api`);
}

bootstrap();
