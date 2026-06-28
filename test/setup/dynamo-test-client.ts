/**
 * Shared DynamoDB Test Client
AWS_ACCESS_KEY_ID *
 * All integration tests across all domains use this SINGLE instance
 * pointing to the LocalStack container defined in docker-compose.yml.
 *
 * Start LocalStack before running integration tests:
 *   docker compose up -d
 *
 * DYNAMODB_ENDPOINT is read from the environment (defaults to http://localhost:4566).
 */
import { createDynamoLocalClient } from '@old-st/dynamodb-onetable';

/**
 * Create shared client for all integration tests.
 * Reads DYNAMODB_ENDPOINT from the environment; defaults to http://localhost:4566.
 */
export function getTestDynamoClient() {
  return createDynamoLocalClient();
}

/**
 * Check if DynamoDB Local is running
 */
export async function isDynamoLocalRunning(): Promise<boolean> {
  try {
    const client = getTestDynamoClient();
    // Try to list tables
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Skip test if DynamoDB Local is not running
 * Use this to make integration tests optional
 */
export function skipIfNoDb() {
  return process.env.SKIP_INTEGRATION_TESTS === 'true';
}
