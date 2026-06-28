// monitoring-api-service uses Lambda Web Adapter — plain HTTP server on port 8080.
// No @codegenie/serverless-express, no STAGE branching.
// The Lambda Web Adapter extension intercepts requests on 8080 and translates
// them to/from the Lambda invocation event format.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MonitoringExceptionFilter } from './presentation/filters/monitoring-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.setGlobalPrefix('api');

  // CORS — allow monitoring-webapp origin only
  const webappOrigin = process.env.MONITORING_WEBAPP_URL ?? 'http://localhost:4300';
  app.enableCors({
    origin: webappOrigin,
    credentials: true,
  });

  app.useGlobalFilters(new MonitoringExceptionFilter());

  if (process.env.STAGE === 'local' || process.env.SWAGGER_ENABLED === 'true') {
    // Lazy require — keeps @nestjs/swagger out of the cold-start parse path
    // when SWAGGER_ENABLED is not set in deployed environments.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
    const builder = new DocumentBuilder()
      .setTitle('Monitoring API')
      .setDescription('Internal monitoring API — metrics, logs, traces, alarms, services')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth');
    // In deployed environments the API Gateway routes traffic to this Lambda
    // under /{DOMAIN_PREFIX}, and Lambda Web Adapter strips that prefix before
    // forwarding to NestJS. Without addServer(), Swagger UI's "Try it out"
    // would call /api/... directly and miss the gateway prefix → 404.
    if (process.env.DOMAIN_PREFIX) {
      builder.addServer(`/${process.env.DOMAIN_PREFIX}`);
    }

    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, builder.build()));
  }

  // Lambda Web Adapter expects the app to listen on 8080
  const port = parseInt(process.env.MONITORING_API_PORT ?? '8080', 10);
  await app.listen(port);
}

bootstrap();
