import { S3Client } from '@aws-sdk/client-s3';

/**
 * Create an S3Client for LocalStack.
 * Uses STAGE === 'local' as the guard (consistent with §7.1).
 */
export function createLocalS3Client(region = 'us-east-1'): S3Client {
  return createS3Client({
    region,
    endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  });
}

/**
 * Create an S3Client for real AWS.
 * No endpoint override — SDK resolves credentials via IAM role / environment.
 */
export function createAwsS3Client(
  region = process.env.AWS_REGION || 'us-east-1',
): S3Client {
  return createS3Client({ region });
}

/**
 * Create an S3Client from an explicit config object.
 */
export function createS3Client(config: {
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.endpoint && { endpoint: config.endpoint }),
    ...(config.forcePathStyle !== undefined && {
      forcePathStyle: config.forcePathStyle,
    }),
    ...(config.credentials && { credentials: config.credentials }),
  });
}
