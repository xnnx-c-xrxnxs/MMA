export interface QueueAttributes {
  queueUrl: string;
  queueName: string;
  approximateNumberOfMessages: number;
  approximateNumberOfMessagesNotVisible: number;
  approximateNumberOfMessagesDelayed: number;
  isDlq: boolean;
}

export interface ISqsMonitoringProvider {
  listQueues(namePrefix: string): Promise<string[]>;
  getQueueAttributes(queueUrl: string): Promise<QueueAttributes>;
  getDlqDepths(namePrefix: string): Promise<QueueAttributes[]>;
}
