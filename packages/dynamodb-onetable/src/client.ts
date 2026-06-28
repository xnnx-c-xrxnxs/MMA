import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Dynamo } from 'dynamodb-onetable/Dynamo';

export interface DynamoClientConfig {
  region: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export function createDynamoClient(config: DynamoClientConfig): Dynamo {
  const dynamoDbClient = new DynamoDBClient({
    region: config.region,
    ...(config.endpoint && { endpoint: config.endpoint }),
    ...(config.credentials && { credentials: config.credentials }),
  });

  return new Dynamo({
    client: dynamoDbClient,
    marshall: {
      convertClassInstanceToMap: true,
      removeUndefinedValues: true,
    },
  });
}

// Helper for DynamoDB Local (for testing)
export function createDynamoLocalClient(region = 'us-east-1'): Dynamo {
  return createDynamoClient({
    region,
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:4566',
  });
}

// Helper for LocalStack
export function createLocalStackClient(region = 'us-east-1'): Dynamo {
  return createDynamoClient({
    region,
    endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
  });
}

// Helper for AWS
export function createAWSClient(region = 'us-east-1'): Dynamo {
  return createDynamoClient({ region });
}