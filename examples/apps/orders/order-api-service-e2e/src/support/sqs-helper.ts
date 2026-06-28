import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  PurgeQueueCommand,
} from '@aws-sdk/client-sqs';

const client = new SQSClient({
  region: process.env.DEFAULT_REGION ?? 'eu-west-2',
  endpoint: process.env.LOCALSTACK_ENDPOINT ?? 'http://localhost:4566',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
  },
});

/**
 * Receive messages from an SQS queue with short-poll retry.
 * Returns parsed message bodies. Deletes received messages from the queue.
 */
export async function receiveMessages(
  queueUrl: string,
  options: { maxRetries?: number; waitMs?: number; maxMessages?: number } = {},
): Promise<unknown[]> {
  const { maxRetries = 5, waitMs = 500, maxMessages = 10 } = options;
  const messages: unknown[] = [];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 1,
      }),
    );

    if (result.Messages && result.Messages.length > 0) {
      for (const msg of result.Messages) {
        if (msg.Body) {
          messages.push(JSON.parse(msg.Body));
        }
        if (msg.ReceiptHandle) {
          await client.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: msg.ReceiptHandle,
            }),
          );
        }
      }
      return messages;
    }

    // Wait before retrying — message may not be visible yet
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return messages;
}

/**
 * Purge all messages from a queue (call in beforeAll/afterAll for isolation).
 */
export async function purgeQueue(queueUrl: string): Promise<void> {
  try {
    await client.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
  } catch {
    // PurgeQueue has a 60-second cooldown — ignore errors
  }
}
