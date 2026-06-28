/**
 * Init Runner Entrypoint
 *
 * Generic task dispatcher for deployment initialization. Reads the INIT_TASKS
 * env var (JSON array) and executes each task by type. Resolves secrets from
 * AWS Secrets Manager when needed.
 *
 * Supported task types:
 *   prisma-migrate  — npx prisma migrate deploy --schema=/app/prisma/{domain}/schema.prisma
 *   custom-script   — node /app/scripts/{script}
 *   dynamodb-seed   — (future) stub: logs and skips
 *   s3-init         — (future) stub: logs and skips
 */

import { execSync } from 'node:child_process';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// ─── Secret Resolution ──────────────────────────────────────────────────────

async function resolveSecrets() {
  const arn = process.env.AWS_SECRETS_ARN;
  const allowList = (process.env.SECRETS_ALLOW_LIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!arn || allowList.length === 0) return;

  console.log(`[init-runner] Resolving secrets from ${arn}...`);
  console.log(`[init-runner] Allow list: ${allowList.join(', ')}`);

  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: arn }),
  );

  const secret = JSON.parse(response.SecretString);

  for (const key of allowList) {
    if (key in secret) {
      process.env[key] = secret[key];
      console.log(`[init-runner]   ✓ ${key} populated`);
    } else {
      console.warn(`[init-runner]   ⚠ ${key} not found in secret`);
    }
  }
}

// ─── Task Dispatchers ───────────────────────────────────────────────────────

function runPrismaMigrate(task) {
  const schemaPath = `/app/prisma/${task.domain}/schema.prisma`;
  console.log(
    `[init-runner] Running prisma migrate deploy for domain "${task.domain}"...`,
  );
  execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
    stdio: 'inherit',
    env: process.env,
  });
  console.log(`[init-runner] ✓ Prisma migrations complete for "${task.domain}"`);
}

function runCustomScript(task) {
  const scriptPath = `/app/scripts/${task.script}`;
  console.log(`[init-runner] Running custom script "${task.script}"...`);
  execSync(`node ${scriptPath}`, {
    stdio: 'inherit',
    env: process.env,
  });
  console.log(`[init-runner] ✓ Custom script "${task.script}" complete`);
}

function runStub(task) {
  console.log(
    `[init-runner] Task type "${task.type}" is not yet implemented — skipping "${task.name}"`,
  );
}

const DISPATCHERS = {
  'prisma-migrate': runPrismaMigrate,
  'custom-script': runCustomScript,
  'dynamodb-seed': runStub,
  's3-init': runStub,
};

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const tasksJson = process.env.INIT_TASKS;
  if (!tasksJson) {
    console.log('[init-runner] No INIT_TASKS env var — nothing to do.');
    process.exit(0);
  }

  const tasks = JSON.parse(tasksJson);
  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log('[init-runner] INIT_TASKS is empty — nothing to do.');
    process.exit(0);
  }

  console.log(`[init-runner] ${tasks.length} task(s) to run:`);
  for (const t of tasks) {
    console.log(`  - ${t.name} (${t.type})`);
  }
  console.log('');

  // Resolve secrets before running any tasks
  await resolveSecrets();
  console.log('');

  // Execute each task sequentially
  let failed = 0;
  for (const task of tasks) {
    const dispatcher = DISPATCHERS[task.type];
    if (!dispatcher) {
      console.warn(
        `[init-runner] ⚠ Unknown task type "${task.type}" for "${task.name}" — skipping`,
      );
      continue;
    }

    try {
      dispatcher(task);
    } catch (err) {
      console.error(
        `[init-runner] ✗ Task "${task.name}" (${task.type}) failed:`,
        err.message,
      );
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n[init-runner] ${failed} task(s) failed.`);
    process.exit(1);
  }

  console.log('\n[init-runner] All tasks completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[init-runner] Fatal error:', err);
  process.exit(1);
});
