import {
  SQSClient,
  ListQueuesCommand,
  GetQueueAttributesCommand,
  QueueAttributeName,
} from '@aws-sdk/client-sqs';
import {
  ISqsMonitoringProvider,
  QueueAttributes,
} from '../interfaces/sqs-monitoring-provider.interface';

function extractQueueName(queueUrl: string): string {
  const parts = queueUrl.split('/');
  return parts[parts.length - 1] ?? queueUrl;
}

export class SqsMonitoringProvider implements ISqsMonitoringProvider {
  private readonly client: SQSClient;

  constructor(region: string) {
    this.client = new SQSClient({ region });
  }

  async listQueues(namePrefix: string): Promise<string[]> {
    const response = await this.client.send(
      new ListQueuesCommand({ QueueNamePrefix: namePrefix, MaxResults: 100 }),
    );
    return response.QueueUrls ?? [];
  }

  async getQueueAttributes(queueUrl: string): Promise<QueueAttributes> {
    const response = await this.client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: [
          QueueAttributeName.ApproximateNumberOfMessages,
          QueueAttributeName.ApproximateNumberOfMessagesNotVisible,
          QueueAttributeName.ApproximateNumberOfMessagesDelayed,
        ],
      }),
    );

    const attrs = response.Attributes ?? {};
    const queueName = extractQueueName(queueUrl);

    return {
      queueUrl,
      queueName,
      approximateNumberOfMessages: parseInt(attrs.ApproximateNumberOfMessages ?? '0', 10),
      approximateNumberOfMessagesNotVisible: parseInt(attrs.ApproximateNumberOfMessagesNotVisible ?? '0', 10),
      approximateNumberOfMessagesDelayed: parseInt(attrs.ApproximateNumberOfMessagesDelayed ?? '0', 10),
      isDlq: queueName.endsWith('-dlq'),
    };
  }

  async getDlqDepths(namePrefix: string): Promise<QueueAttributes[]> {
    const allUrls = await this.listQueues(namePrefix);
    const dlqUrls = allUrls.filter((url) => extractQueueName(url).endsWith('-dlq'));

    const results = await Promise.all(dlqUrls.map((url) => this.getQueueAttributes(url)));
    return results;
  }
}
