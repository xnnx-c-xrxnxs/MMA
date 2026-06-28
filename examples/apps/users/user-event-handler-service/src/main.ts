import { initTelemetry } from '@old-st/telemetry';
initTelemetry('user-event-handler-service');

import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Context, SQSRecord } from 'aws-lambda';
import { AppModule } from './app/app.module';
import { UserEventHandlerService } from './application/services/user-event-handler.service';
import { SqsLocalService } from './infrastructure/sqs/sqs-local.service';
import { NormalizedSqsRecord } from './application/interfaces/normalized-sqs-record.interface';

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
  // setImmediate defers polling start until after module initialisation completes
  setImmediate(async () => {
    const app = await bootstrap();
    const sqsLocalService = app.get(SqsLocalService);
    Logger.log('Starting local SQS polling...', 'UserEventHandlerService');
    sqsLocalService.pollQueue();
  });
}

// ─── AWS Lambda handler ───────────────────────────────────────────────────────
export const handler = async (
  event: { Records: SQSRecord[] },
  _context: Context,
) => {
  const app = await bootstrap();
  const eventHandlerService = app.get(UserEventHandlerService);

  // Map Lambda SQSRecord (lowercase fields) → NormalizedSqsRecord
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
