import { SQSClient } from '@aws-sdk/client-sqs';

export interface SqsClientConfig {
  region: string;
  /** Explicit endpoint override — used for LocalStack. Omit for real AWS (resolved via SDK defaults). */
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

/**
 * Create an SQSClient from an explicit config object.
 * Framework-free — no NestJS dependency.
 */
export function createSqsClient(config: SqsClientConfig): SQSClient {
  return new SQSClient({
    region: config.region,
    ...(config.endpoint && { endpoint: config.endpoint }),
    ...(config.credentials && { credentials: config.credentials }),
  });
}

/**
 * Create an SQSClient pointed at LocalStack.
 * Uses STAGE === 'local' as the guard (consistent with CLAUDE.md §7.1).
 * Call this inside a NestJS module useFactory when STAGE === 'local'.
 */
export function createLocalSqsClient(region = 'us-east-1'): SQSClient {
  return createSqsClient({
    region,
    endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  });
}

/**
 * Create an SQSClient for real AWS.
 * No endpoint override — SDK resolves credentials via IAM role / environment.
 * Call this inside a NestJS module useFactory when STAGE !== 'local'.
 */
export function createAwsSqsClient(
  region = process.env.AWS_REGION || 'us-east-1',
): SQSClient {
  return createSqsClient({ region });
}
