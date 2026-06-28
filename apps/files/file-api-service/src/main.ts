// file-api-service uses Lambda Web Adapter in deployed environments.
// Single-mode HTTP server — works identically locally and in Lambda.
import { initTelemetry, correlationMiddleware } from '@old-st/telemetry';
initTelemetry('file-api-service');

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SecretsConfig } from '@old-st/aws-secrets';
import { AppModule } from './app/app.module';
import { DomainExceptionFilter } from './presentation';
import { HttpLoggingInterceptor } from './presentation/interceptors/http-logging.interceptor';

async function bootstrap() {
  // Resolve CloudFront signing credentials at cold-start (no-op locally).
  // Both values rotate together and live in the project Secrets Manager secret;
  // CLOUDFRONT_DOMAIN stays Terraform-injected because it is public.
  if (process.env.STAGE !== 'local') {
    await SecretsConfig.resolve([
      'CLOUDFRONT_KEY_PAIR_ID',
      'CLOUDFRONT_PRIVATE_KEY',
    ]);
  }

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

  if (process.env.STAGE === 'local' || process.env.SWAGGER_ENABLED === 'true') {
    // Lazy require — keeps @nestjs/swagger out of the cold-start parse path
    // when SWAGGER_ENABLED is not set in deployed environments.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
    const builder = new DocumentBuilder()
      .setTitle(`FILE-API-SERVICE [${process.env.STAGE ?? 'local'}]`)
      .setDescription('FILE-API-SERVICE API — Presigned URL file upload/download')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'JWT', description: 'Enter JWT token', in: 'header' },
        'JWT-auth',
      );
    // In deployed environments the API Gateway routes traffic to this Lambda
    // under /{DOMAIN_PREFIX}, and Lambda Web Adapter strips that prefix before
    // forwarding to NestJS. Without addServer(), Swagger UI's "Try it out"
    // would call /api/... directly and miss the gateway prefix → 404.
    if (process.env.DOMAIN_PREFIX) {
      builder.addServer(`/${process.env.DOMAIN_PREFIX}`);
    }

    const document = SwaggerModule.createDocument(app, builder.build());
    SwaggerModule.setup('swagger', app, document, { useGlobalPrefix: true });
  }

  const port = process.env.FILE_SERVICE_PORT || 8080;
  await app.listen(port);
  Logger.log(`🚀 FILE-API-SERVICE is running on: http://localhost:${port}/api`);
}

bootstrap();
