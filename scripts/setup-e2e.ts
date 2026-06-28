/**
 * E2E Test Setup Script
 *
 * Creates isolated E2E DynamoDB tables, SQS queues, and Postgres database
 * so E2E tests never interfere with development data.
 *
 * Usage:
 *   pnpm e2e:setup           # Create E2E infrastructure
 *   pnpm e2e:setup --force   # Delete then recreate all E2E infrastructure
 *
 * Prerequisites:
 *   - Docker running: docker compose up -d
 *   - .env.e2e at workspace root (cp .env.e2e.example .env.e2e)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import {
  SQSClient,
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueUrlCommand,
  ListQueuesCommand,
} from '@aws-sdk/client-sqs';
import { Client as PgClient } from 'pg';

// ─── Load .env.e2e ───────────────────────────────────────────────────────────
function loadEnvFile(envFile: string): void {
  const envFilePath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envFilePath)) {
    // In CI, env vars are already injected via $GITHUB_ENV — skip silently.
    console.log(`ℹ️  ${envFile} not found — using environment variables from process.env.`);
    return;
  }
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env.e2e');

// ─── CLI flags ────────────────────────────────────────────────────────────────
const FORCE_RECREATE = process.argv.includes('--force');

// ─── AWS clients ──────────────────────────────────────────────────────────────
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
const REGION = process.env.DEFAULT_REGION || 'eu-west-2';

const dynamoClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

const sqsClient = new SQSClient({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

// ─── DynamoDB E2E table configs (mirrors setup-localstack.ts with E2E names) ─
interface TableConfig {
  tableName: string;
  description: string;
  primaryHashKey: string;
  primarySortKey: string;
  attributeDefinitions: Array<{ name: string; type: 'S' | 'N' | 'B' }>;
  gsis: Array<{ indexName: string; hashKey: string; sortKey?: string }>;
}

const TABLE_CONFIGS: TableConfig[] = [
  // ── Add E2E DynamoDB tables here when a domain is added ──
];

// ─── SQS E2E queue configs ───────────────────────────────────────────────────
interface QueueConfig {
  queueNameEnvVar: string;
  queueNameDefault: string;
  description: string;
  /**
   * Set to true (the default) to create a FIFO queue.
   * The queue name will be automatically suffixed with `.fifo` if not already present.
   * ContentBasedDeduplication is enabled automatically.
   * Set to false ONLY for explicit Standard queues.
   */
  fifo?: boolean;
}

const QUEUE_CONFIGS: QueueConfig[] = [
  // ── Add E2E SQS queues here when a new event-driven service is added ──
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setupDynamoTables(): Promise<void> {
  console.log('\n📦 DynamoDB E2E Tables');
  const existing = (await dynamoClient.send(new ListTablesCommand({}))).TableNames ?? [];

  for (const config of TABLE_CONFIGS) {
    console.log(`  Table: ${config.tableName}`);
    const exists = existing.includes(config.tableName);

    if (exists && !FORCE_RECREATE) {
      console.log('    Already exists — skipping.');
      continue;
    }

    if (exists && FORCE_RECREATE) {
      await dynamoClient.send(new DeleteTableCommand({ TableName: config.tableName }));
      console.log('    Deleted existing table.');
    }

    await dynamoClient.send(
      new CreateTableCommand({
        TableName: config.tableName,
        AttributeDefinitions: config.attributeDefinitions.map(({ name, type }) => ({
          AttributeName: name,
          AttributeType: type,
        })),
        KeySchema: [
          { AttributeName: config.primaryHashKey, KeyType: 'HASH' },
          { AttributeName: config.primarySortKey, KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: config.gsis.map((gsi) => ({
          IndexName: gsi.indexName,
          KeySchema: [
            { AttributeName: gsi.hashKey, KeyType: 'HASH' },
            ...(gsi.sortKey ? [{ AttributeName: gsi.sortKey, KeyType: 'RANGE' as const }] : []),
          ],
          Projection: { ProjectionType: 'ALL' as const },
        })),
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
    console.log('    Created ✓');
  }
}

async function setupSqsQueues(): Promise<void> {
  console.log('\n📨 SQS E2E Queues');
  const existingUrls = (await sqsClient.send(new ListQueuesCommand({}))).QueueUrls ?? [];

  for (const config of QUEUE_CONFIGS) {
    const isFifo = config.fifo !== false; // default to FIFO
    let queueName = process.env[config.queueNameEnvVar] || config.queueNameDefault;
    if (isFifo && !queueName.endsWith('.fifo')) {
      queueName = `${queueName}.fifo`;
    }
    console.log(`  Queue: ${queueName}${isFifo ? ' (FIFO)' : ''}`);
    const exists = existingUrls.some((url) => url.endsWith(`/${queueName}`));

    if (exists && !FORCE_RECREATE) {
      console.log('    Already exists — skipping.');
      continue;
    }

    if (exists && FORCE_RECREATE) {
      try {
        const urlResult = await sqsClient.send(new GetQueueUrlCommand({ QueueName: queueName }));
        if (urlResult.QueueUrl) {
          await sqsClient.send(new DeleteQueueCommand({ QueueUrl: urlResult.QueueUrl }));
        }
        await new Promise((r) => setTimeout(r, 1000));
      } catch {
        // Queue may not exist — safe to ignore
      }
      console.log('    Deleted existing queue.');
    }

    const attributes: Record<string, string> | undefined = isFifo
      ? { FifoQueue: 'true', ContentBasedDeduplication: 'true' }
      : undefined;
    await sqsClient.send(new CreateQueueCommand({ QueueName: queueName, Attributes: attributes }));
    console.log(`    Created ✓`);
  }
}

async function setupPostgres(): Promise<void> {
  // ── No Prisma domains in the base template. ──
  // When a Prisma domain is added, create its E2E database here and run `prisma migrate deploy`.
  return;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' E2E Infrastructure Setup');
  console.log(`  Endpoint: ${ENDPOINT}`);
  console.log(`  Region  : ${REGION}`);
  if (FORCE_RECREATE) console.log('  Mode    : --force (recreate)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await setupDynamoTables();
  await setupSqsQueues();
  await setupPostgres();

  console.log('\n✅ E2E infrastructure ready.\n');
}

main().catch((err) => {
  console.error('❌ E2E setup failed:', err);
  process.exit(1);
});
