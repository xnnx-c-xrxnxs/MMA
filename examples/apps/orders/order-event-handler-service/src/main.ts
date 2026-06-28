import { initTelemetry } from '@old-st/telemetry';
initTelemetry('order-event-handler-service');

import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Context, SQSRecord } from 'aws-lambda';
import { AppModule } from './app/app.module';
import { OrderEventHandlerService } from './application/services/order-event-handler.service';
import { SqsLocalService } from './infrastructure/sqs/sqs-local.service';
import { NormalizedSqsRecord } from './application/interfaces/normalized-sqs-record.interface';
import { SecretsConfig } from '@old-st/aws-secrets';

// ─── Cached NestJS application context (warm Lambda re-use) ──────────────────
let cachedApp: INestApplicationContext | undefined;

async function bootstrap(): Promise<INestApplicationContext> {
  if (!cachedApp) {
    cachedApp = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn'],
    });
  }
  return cachedApp;
}

// ─── Local development — poll LocalStack SQS ─────────────────────────────────
if (process.env.STAGE === 'local') {
  setImmediate(async () => {
    const app = await bootstrap();
    const sqsLocalService = app.get(SqsLocalService);
    Logger.log('Starting local SQS polling...', 'OrderEventHandlerService');
    sqsLocalService.pollQueue();
  });
}

// ─── AWS Lambda handler ───────────────────────────────────────────────────────
export const handler = async (
  event: { Records: SQSRecord[] },
  _context: Context,
) => {
  // Resolve project secret once at cold-start: populates ORDERS_DATABASE_URL
  // from AWS Secrets Manager before NestJS boots. Only the keys this service
  // actually needs are written to process.env (strict isolation).
  await SecretsConfig.resolve(['ORDERS_DATABASE_URL']);

  const app = await bootstrap();
  const eventHandlerService = app.get(OrderEventHandlerService);

  const records: NormalizedSqsRecord[] = event.Records.map((r) => ({
    body: r.body,
    messageId: r.messageId,
    receiptHandle: r.receiptHandle,
    messageAttributes: r.messageAttributes as unknown as Record<string, { DataType: string; StringValue?: string }>,
  }));

  await eventHandlerService.handleRecords(records);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Records processed successfully' }),
  };
};
