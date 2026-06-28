// product-api-service uses Lambda Web Adapter in deployed environments.
// Single-mode HTTP server — works identically locally and in Lambda.
import { initTelemetry, correlationMiddleware } from '@old-st/telemetry';
initTelemetry('product-api-service');

import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { DomainExceptionFilter } from './presentation';

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

  if (process.env.STAGE === 'local' || process.env.SWAGGER_ENABLED === 'true') {
    // Lazy require — keeps @nestjs/swagger out of the cold-start parse path
    // when SWAGGER_ENABLED is not set in deployed environments.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle(`PRODUCT-API-SERVICE [${process.env.STAGE ?? 'local'}]`)
      .setDescription('PRODUCT-API-SERVICE API')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'JWT', description: 'Enter JWT token', in: 'header' },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document, { useGlobalPrefix: true });
  }

  const port = process.env.PRODUCT_SERVICE_PORT || 8080;
  await app.listen(port);
  Logger.log(`🚀 PRODUCT-API-SERVICE is running on: http://localhost:${port}/api`);
}

bootstrap();
