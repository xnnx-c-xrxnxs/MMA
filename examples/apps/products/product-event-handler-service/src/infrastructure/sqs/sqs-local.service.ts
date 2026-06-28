import { Injectable } from '@nestjs/common';
import { createLogger } from '@old-st/telemetry';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';

const logger = createLogger('product-event-handler-service');
import { NormalizedSqsRecord } from '../../application/interfaces/normalized-sqs-record.interface';
import { ProductEventHandlerService } from '../../application/services/product-event-handler.service';

/**
 * SqsLocalService
 *
 * Polls LocalStack SQS and delegates to ProductEventHandlerService.
 * Used ONLY when STAGE=local — replaced by the Lambda handler in production.
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
    private readonly productEventHandlerService: ProductEventHandlerService,
  ) {}

  async pollQueue(): Promise<void> {
    const queueUrl = process.env.PRODUCT_EVENTS_SQS_QUEUE_URL;
    if (!queueUrl) {
      throw new Error('PRODUCT_EVENTS_SQS_QUEUE_URL is not defined');
    }
    logger.info('Polling queue', { queueUrl });

    while (true) {
      try {
        const { Messages } = await this.sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
            // Return all message attributes so OTel trace context (traceparent) is available
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
      messageAttributes: message.MessageAttributes as unknown as Record<string, { DataType: string; StringValue?: string }>,
    };

    logger.info('Processing message', { messageId: normalized.messageId ?? '(no id)' });
    await this.productEventHandlerService.handleRecords([normalized]);

    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }
}
