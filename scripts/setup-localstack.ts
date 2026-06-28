/**
 * LocalStack Setup Script
 *
 * Creates all DynamoDB tables and SQS queues on LocalStack required by this monorepo's services.
 *
 * Usage (recommended — uses package.json scripts):
 *   pnpm run localstack:setup           # Create tables + queues (skip if already exist)
 *   pnpm run localstack:setup:force     # Delete then recreate all tables + queues
 *   pnpm run localstack:status          # List existing tables + queues only
 *
 * Direct invocation:
 *   npx ts-node --project scripts/tsconfig.json scripts/setup-localstack.ts
 *   npx ts-node --project scripts/tsconfig.json scripts/setup-localstack.ts --force
 *
 * Prerequisites:
 *   - LocalStack running: docker compose up -d
 *   - .env.local at workspace root (see §7.1 in CLAUDE.md)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO MAINTAIN THIS FILE (read this before modifying):
 *
 *   This monorepo uses single-table design: multiple domain schemas share the
 *   same physical DynamoDB table. Each physical table appears ONCE in
 *   TABLE_CONFIGS below, and all GSIs from every schema that targets that table
 *   are merged into a single CreateTable definition.
 *
 *   When you ADD a new domain schema OR add/remove a GSI from an existing schema:
 *
 *   ┌─ Same physical table as an existing entry? ─────────────────────────────┐
 *   │  Find the TABLE_CONFIGS entry whose `tableName` matches the env var      │
 *   │  used by that domain (e.g. USERS_DYNAMODB_TABLE_NAME).                  │
 *   │                                                                          │
 *   │  New GSI added? →                                                        │
 *   │    1. Add the new GSI key attribute(s) to AttributeDefinitions            │
 *   │       (type 'S' for String, 'N' for Number).                             │
 *   │    2. Add the GSI descriptor to GlobalSecondaryIndexes.                  │
 *   │    3. Document which schema/domain uses the new GSI in the comment       │
 *   │       block above GlobalSecondaryIndexes.                                │
 *   │                                                                          │
 *   │  GSI removed? →                                                          │
 *   │    1. Remove it from GlobalSecondaryIndexes.                             │
 *   │    2. Remove any now-unused key attributes from AttributeDefinitions.    │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *
 *   ┌─ New physical table needed (new service with its own table name)? ───────┐
 *   │  1. Add a new TableConfig entry to TABLE_CONFIGS following the pattern.  │
 *   │  2. Document which domain + env var drives the table name.               │
 *   │  3. Add the env var to .env.local (§7.1 in CLAUDE.md).    │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *
 *   After any schema change, apply updates to LocalStack:
 *     pnpm run localstack:setup:force
 *     # or: npx ts-node --project scripts/tsconfig.json scripts/setup-localstack.ts --force
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  ListTablesCommand,
  type AttributeDefinition,
  type GlobalSecondaryIndex,
  type KeySchemaElement,
} from '@aws-sdk/client-dynamodb';
import {
  SQSClient,
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueUrlCommand,
  ListQueuesCommand,
} from '@aws-sdk/client-sqs';
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListBucketsCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';

// ─── Load .env.local (no dotenv dependency needed) ───────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    // Only set if not already present in the environment (process.env takes precedence)
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// ─── CLI flags ────────────────────────────────────────────────────────────────
const FORCE_RECREATE = process.argv.includes('--force');
const STATUS_ONLY = process.argv.includes('--status');

// ─── DynamoDB client (points at LocalStack) ───────────────────────────────────
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
const REGION = process.env.DEFAULT_REGION || 'us-east-1';

const client = new DynamoDBClient({
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

const s3Client = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

// ─── Type helpers ─────────────────────────────────────────────────────────────
type AttributeType = 'S' | 'N' | 'B';

interface GsiDefinition {
  /** DynamoDB GSI index name, e.g. 'GSI1' */
  indexName: string;
  /** Attribute name used as the GSI hash key */
  hashKey: string;
  /** Attribute name used as the GSI sort key, or undefined for hash-only GSIs */
  sortKey?: string;
}

interface TableConfig {
  /**
   * Physical DynamoDB table name — must match the value of the relevant
   * {DOMAIN}_DYNAMODB_TABLE_NAME env var (see .env.local §7.1).
   */
  tableName: string;
  /** Human-readable description of which domain(s) use this table. */
  description: string;
  /** Primary key — hash attribute name. Almost always 'PK'. */
  primaryHashKey: string;
  /** Primary key — sort attribute name. Almost always 'SK'. */
  primarySortKey: string;
  /**
   * ALL attribute definitions needed for primary key + every GSI key.
   * DynamoDB only requires key attributes here — non-key data attributes are
   * inferred from the items themselves.
   */
  attributeDefinitions: Array<{ name: string; type: AttributeType }>;
  /**
   * All GSIs to create on this table.
   * These must be the UNION of all GSIs used by every schema that writes to
   * this physical table.
   *
   * Domains / schemas contributing GSIs to this table:
   *   [document contributing schemas here — updated whenever a schema changes]
   */
  gsis: GsiDefinition[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE CONFIGURATIONS
//
// Add one entry per physical DynamoDB table. When multiple domain schemas
// share the same physical table, merge their GSIs into a single entry here.
// ─────────────────────────────────────────────────────────────────────────────
const TABLE_CONFIGS: TableConfig[] = [
  // ── Add a DynamoDB table entry below when you scaffold a DynamoDB-backed domain ──
  // See examples/scripts/setup-localstack.ts for the full USERS / PRODUCTS reference
  // implementation, and the `new-dynamo-schema` skill for the entry template.
];
// ─────────────────────────────────────────────────────
// QUEUE CONFIGURATIONS
//
// Add one entry per SQS queue consumed by an event-driven service in this repo.
//
// ┌─ HOW TO MAINTAIN THIS SECTION ────────────────────────────────────────
// │  FIFO IS THE DEFAULT — all new queues should set fifo: true.     │
// │  Only use fifo: false for explicit high-throughput / fan-out      │
// │  scenarios that do not require ordering or exactly-once delivery. │
// │                                                                   │
// │  When you ADD a new event-driven service:                         │
// │    1. Add a new QueueConfig entry below with fifo: true.          │
// │    2. Set queueNameEnvVar to the env var that holds the queue     │
// │       name (e.g. MY_DOMAIN_SQS_QUEUE_NAME).                      │
// │    3. Set queueNameDefault to a sensible local default            │
// │       (do NOT include .fifo — the script appends it).            │
// │    4. Add {DOMAIN}_SQS_QUEUE_NAME to .env.local.                 │
// │    5. Run: pnpm run localstack:setup:force                       │
// │       The full {DOMAIN}_SQS_QUEUE_URL will be printed — copy     │
// │       it directly into .env.local.                               │
// │       (see §7.1 in CLAUDE.md for the URL format)  │
// └──────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────
interface QueueConfig {
  /**
   * Name of the environment variable that holds the SQS queue name
   * (e.g. 'MY_DOMAIN_SQS_QUEUE_NAME'). Read from .env.local.
   */
  queueNameEnvVar: string;
  /** Fallback queue name used when the env var is not set. */
  queueNameDefault: string;
  /** Human-readable description of which service consumes this queue. */
  description: string;
  /**
   * Set to true (the default) to create a FIFO queue.
   * The queue name will be automatically suffixed with `.fifo` if not already present.
   * ContentBasedDeduplication is enabled so publishers do not need to supply a
   * MessageDeduplicationId on every send (though SqsFifoEventPublisher does so anyway
   * as a local SHA-256 fallback).
   *
   * Set to false ONLY for explicit Standard queues (high-throughput / fan-out scenarios
   * that do not require strict ordering or exactly-once delivery).
   */
  fifo?: boolean;
}

const QUEUE_CONFIGS: QueueConfig[] = [
  // ── Add SQS queues below when a new event-driven service is added ——————

];
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildAttributeDefinitions(config: TableConfig): AttributeDefinition[] {
  return config.attributeDefinitions.map(({ name, type }) => ({
    AttributeName: name,
    AttributeType: type,
  }));
}

function buildPrimaryKeySchema(config: TableConfig): KeySchemaElement[] {
  return [
    { AttributeName: config.primaryHashKey, KeyType: 'HASH' },
    { AttributeName: config.primarySortKey, KeyType: 'RANGE' },
  ];
}

function buildGlobalSecondaryIndexes(config: TableConfig): GlobalSecondaryIndex[] {
  return config.gsis.map((gsi) => {
    const keySchema: KeySchemaElement[] = [
      { AttributeName: gsi.hashKey, KeyType: 'HASH' },
    ];
    if (gsi.sortKey) {
      keySchema.push({ AttributeName: gsi.sortKey, KeyType: 'RANGE' });
    }
    return {
      IndexName: gsi.indexName,
      KeySchema: keySchema,
      Projection: { ProjectionType: 'ALL' },
    };
  });
}

async function listExistingTables(): Promise<string[]> {
  const result = await client.send(new ListTablesCommand({}));
  return result.TableNames ?? [];
}

async function deleteTable(tableName: string): Promise<void> {
  console.log(`  Deleting table "${tableName}"...`);
  await client.send(new DeleteTableCommand({ TableName: tableName }));
  // LocalStack deletes synchronously; no need to wait for ACTIVE status.
  console.log(`  Deleted  "${tableName}"`);
}

async function createTable(config: TableConfig): Promise<void> {
  console.log(`  Creating table "${config.tableName}" (${config.gsis.length} GSIs)...`);
  await client.send(
    new CreateTableCommand({
      TableName: config.tableName,
      AttributeDefinitions: buildAttributeDefinitions(config),
      KeySchema: buildPrimaryKeySchema(config),
      GlobalSecondaryIndexes: buildGlobalSecondaryIndexes(config),
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );
  console.log(`  Created  "${config.tableName}" ✓`);
}

// ─────────────────────────────────────────────────────
// SQS helpers
// ─────────────────────────────────────────────────────

async function listExistingQueues(): Promise<string[]> {
  const result = await sqsClient.send(new ListQueuesCommand({}));
  return result.QueueUrls ?? [];
}

async function deleteQueue(queueName: string): Promise<void> {
  console.log(`  Deleting queue "${queueName}"...`);
  try {
    const urlResult = await sqsClient.send(
      new GetQueueUrlCommand({ QueueName: queueName }),
    );
    if (urlResult.QueueUrl) {
      await sqsClient.send(new DeleteQueueCommand({ QueueUrl: urlResult.QueueUrl }));
    }
    console.log(`  Deleted  "${queueName}"`);
  } catch {
    // Queue may not exist yet — safe to ignore
    console.log(`  Queue "${queueName}" not found — skipping delete.`);
  }
}

async function createQueue(config: QueueConfig): Promise<void> {
  let queueName = process.env[config.queueNameEnvVar] || config.queueNameDefault;
  const isFifo = config.fifo !== false; // FIFO is the default; only Standard when fifo: false

  if (isFifo && !queueName.endsWith('.fifo')) {
    queueName = `${queueName}.fifo`;
  }

  console.log(`  Creating queue "${queueName}"${isFifo ? ' (FIFO)' : ' (Standard)'}...`);

  const attributes: Record<string, string> | undefined = isFifo
    ? { FifoQueue: 'true', ContentBasedDeduplication: 'true' }
    : undefined;

  await sqsClient.send(
    new CreateQueueCommand({
      QueueName: queueName,
      ...(attributes && { Attributes: attributes }),
    }),
  );
  const queueUrl = `http://sqs.${REGION}.localhost.localstack.cloud:4566/000000000000/${queueName}`;
  const urlEnvVar = config.queueNameEnvVar.replace(/_QUEUE_NAME$/, '_QUEUE_URL');
  console.log(`  Created  "${queueName}" ✓`);
  console.log(`  → Add to .env.local:`);
  console.log(`      ${urlEnvVar}=${queueUrl}`);
}

// ─────────────────────────────────────────────────────
// S3 helpers + config
// ─────────────────────────────────────────────────────

interface S3BucketConfig {
  /** Env var name for the bucket name (e.g. FILES_S3_BUCKET_NAME). */
  bucketNameEnvVar: string;
  /** Default bucket name when env var is not set. */
  bucketNameDefault: string;
  /** Human-readable description. */
  description: string;
  /** Whether to set CORS for browser presigned uploads. */
  cors?: boolean;
}

const S3_BUCKET_CONFIGS: S3BucketConfig[] = [
  {
    bucketNameEnvVar: 'FILES_S3_BUCKET_NAME',
    bucketNameDefault: 'mma-files',
    description: 'file-api-service — stores uploaded files, served via presigned URLs',
    cors: true,
  },
];

async function listExistingBuckets(): Promise<string[]> {
  const result = await s3Client.send(new ListBucketsCommand({}));
  return (result.Buckets ?? []).map((b) => b.Name).filter((n): n is string => !!n);
}

async function deleteBucket(bucketName: string): Promise<void> {
  console.log(`  Deleting S3 bucket "${bucketName}"...`);
  try {
    await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
    console.log(`  Deleted  "${bucketName}"`);
  } catch {
    console.log(`  Bucket "${bucketName}" not found — skipping delete.`);
  }
}

async function createBucket(config: S3BucketConfig): Promise<void> {
  const bucketName = process.env[config.bucketNameEnvVar] || config.bucketNameDefault;
  console.log(`  Creating S3 bucket "${bucketName}"...`);

  await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));

  if (config.cors) {
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT'],
              AllowedOrigins: ['http://localhost:4200'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    console.log(`  CORS configured ✓`);
  }

  console.log(`  Created  "${bucketName}" ✓`);
}

// ─────────────────────────────────────────────────────────────────────────────
// De-duplicate configs: if two TableConfig entries resolve to the same table
// name (e.g. both default to 'OldSTTable'), treat them as the same table and
// keep only the first occurrence. This is a safety guard.
// ─────────────────────────────────────────────────────────────────────────────
function deduplicateConfigs(configs: TableConfig[]): TableConfig[] {
  const seen = new Set<string>();
  return configs.filter((c) => {
    if (seen.has(c.tableName)) {
      console.warn(`  [warn] Duplicate table name "${c.tableName}" — skipping second entry.`);
      return false;
    }
    seen.add(c.tableName);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' LocalStack Setup (DynamoDB + SQS + S3)');
  console.log(`  Endpoint : ${ENDPOINT}`);
  console.log(`  Region   : ${REGION}`);
  if (FORCE_RECREATE) console.log('  Mode     : --force (delete + recreate)');
  else if (STATUS_ONLY) console.log('  Mode     : --status (list only)');
  else console.log('  Mode     : create if not exists');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const existingTables = await listExistingTables();
  const existingQueueUrls = await listExistingQueues();

  if (STATUS_ONLY) {
    console.log('Existing DynamoDB tables in LocalStack:');
    if (existingTables.length === 0) {
      console.log('  (none)');
    } else {
      existingTables.forEach((t) => console.log(`  • ${t}`));
    }
    console.log('');
    console.log('Existing SQS queues in LocalStack:');
    if (existingQueueUrls.length === 0) {
      console.log('  (none)');
    } else {
      existingQueueUrls.forEach((q) => console.log(`  • ${q}`));
    }
    console.log('');
    return;
  }

  // ─── DynamoDB tables ──────────────────────────────────
  const configs = deduplicateConfigs(TABLE_CONFIGS);

  for (const config of configs) {
    console.log(`Table: ${config.tableName}`);
    console.log(`  ${config.description}`);

    const exists = existingTables.includes(config.tableName);

    if (exists && !FORCE_RECREATE) {
      console.log(`  Already exists — skipping. Use --force to recreate.\n`);
      continue;
    }

    if (exists && FORCE_RECREATE) {
      await deleteTable(config.tableName);
    }

    await createTable(config);
    console.log('');
  }

  // ─── SQS queues ──────────────────────────────────────
  if (QUEUE_CONFIGS.length > 0) {
    for (const queueConfig of QUEUE_CONFIGS) {
      const queueName = process.env[queueConfig.queueNameEnvVar] || queueConfig.queueNameDefault;
      console.log(`Queue: ${queueName}`);
      console.log(`  ${queueConfig.description}`);

      const exists = existingQueueUrls.some((url) => url.endsWith(`/${queueName}`));

      if (exists && !FORCE_RECREATE) {
        console.log(`  Already exists — skipping. Use --force to recreate.\n`);
        continue;
      }

      if (exists && FORCE_RECREATE) {
        await deleteQueue(queueName);
        // LocalStack requires a short delay after deleting before recreating
        await new Promise((r) => setTimeout(r, 1000));
      }

      await createQueue(queueConfig);
      console.log('');
    }
  }

  // ─── S3 buckets ──────────────────────────────────────
  if (S3_BUCKET_CONFIGS.length > 0) {
    const existingBuckets = await listExistingBuckets();
    for (const bucketConfig of S3_BUCKET_CONFIGS) {
      const bucketName = process.env[bucketConfig.bucketNameEnvVar] || bucketConfig.bucketNameDefault;
      console.log(`S3 Bucket: ${bucketName}`);
      console.log(`  ${bucketConfig.description}`);

      const exists = existingBuckets.includes(bucketName);

      if (exists && !FORCE_RECREATE) {
        console.log(`  Already exists — skipping. Use --force to recreate.\n`);
        continue;
      }

      if (exists && FORCE_RECREATE) {
        await deleteBucket(bucketName);
      }

      await createBucket(bucketConfig);
      console.log('');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Done.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
