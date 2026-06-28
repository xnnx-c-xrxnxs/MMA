/**
 * E2E Test Teardown Script
 *
 * Removes E2E DynamoDB tables, SQS queues, and optionally the Postgres database.
 *
 * Usage:
 *   pnpm e2e:teardown            # Remove E2E infrastructure
 *   pnpm e2e:teardown --drop-db  # Also drop the E2E Postgres database
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  DynamoDBClient,
  DeleteTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import {
  SQSClient,
  DeleteQueueCommand,
  GetQueueUrlCommand,
  ListQueuesCommand,
} from '@aws-sdk/client-sqs';
import { Client as PgClient } from 'pg';

// ─── Load .env.e2e ───────────────────────────────────────────────────────────
const envFilePath = path.resolve(process.cwd(), '.env.e2e');
if (fs.existsSync(envFilePath)) {
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

const DROP_DB = process.argv.includes('--drop-db');
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

// E2E table names — add your domain tables here.
const E2E_TABLE_NAMES: string[] = [];

// E2E queue names — add your domain queues here.
const E2E_QUEUE_NAMES: string[] = [];

async function teardownDynamo(): Promise<void> {
  console.log('\n📦 Removing DynamoDB E2E tables');
  const existing = (await dynamoClient.send(new ListTablesCommand({}))).TableNames ?? [];

  for (const tableName of E2E_TABLE_NAMES) {
    if (existing.includes(tableName)) {
      await dynamoClient.send(new DeleteTableCommand({ TableName: tableName }));
      console.log(`  Deleted "${tableName}" ✓`);
    } else {
      console.log(`  "${tableName}" not found — skipping.`);
    }
  }
}

async function teardownSqs(): Promise<void> {
  console.log('\n📨 Removing SQS E2E queues');
  const existingUrls = (await sqsClient.send(new ListQueuesCommand({}))).QueueUrls ?? [];

  for (const queueName of E2E_QUEUE_NAMES) {
    const exists = existingUrls.some((url) => url.endsWith(`/${queueName}`));
    if (exists) {
      try {
        const urlResult = await sqsClient.send(new GetQueueUrlCommand({ QueueName: queueName }));
        if (urlResult.QueueUrl) {
          await sqsClient.send(new DeleteQueueCommand({ QueueUrl: urlResult.QueueUrl }));
        }
        console.log(`  Deleted "${queueName}" ✓`);
      } catch {
        console.log(`  Failed to delete "${queueName}" — may already be gone.`);
      }
    } else {
      console.log(`  "${queueName}" not found — skipping.`);
    }
  }
}

async function teardownPostgres(): Promise<void> {
  // ── No Prisma domains in the base template. ──
  // When a Prisma domain is added, drop its E2E database here when --drop-db is passed.
  if (!DROP_DB) {
    console.log('\n🐘 Postgres E2E database — skipping (no Prisma domains registered)');
  }
  return;
}

async function main(): Promise<void> {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' E2E Infrastructure Teardown');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await teardownDynamo();
  await teardownSqs();
  await teardownPostgres();

  console.log('\n✅ E2E infrastructure removed.\n');
}

main().catch((err) => {
  console.error('❌ E2E teardown failed:', err);
  process.exit(1);
});
