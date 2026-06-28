/**
 * Init Runner — Lambda Handler
 *
 * Wraps the init-runner task dispatcher for AWS Lambda invocation.
 * Invoked synchronously by the CD workflow via `aws lambda invoke`.
 *
 * The INIT_TASKS, AWS_SECRETS_ARN, SECRETS_ALLOW_LIST, and all resolved
 * infra env vars are injected as Lambda environment variables by Terraform.
 *
 * Supported task types (dispatched by task type field):
 *   prisma-migrate  — npx prisma migrate deploy --schema=/var/task/prisma/{domain}/schema.prisma
 *   custom-script   — node /var/task/scripts/{script}
 *   dynamodb-seed   — stub (logs and skips)
 *   s3-init         — stub (logs and skips)
 *
 * ── Adding a new Prisma domain ───────────────────────────────────────────────
 * In the CD workflow's "Package init-runner" step, add a line to copy the
 * domain's Prisma schema + migrations into the ZIP:
 *   cp -r packages/{domain}-domain/src/infrastructure/prisma/ /tmp/init-runner/prisma/{domain}/
 *
 * ── Adding a custom script ───────────────────────────────────────────────────
 * Place your .mjs script in infra/init-runner/scripts/ and add a deployTasks
 * entry in service-registry.json with type: "custom-script".
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
  // Prisma schemas are copied into /var/task/prisma/{domain}/ when the ZIP is built
  const schemaPath = `/var/task/prisma/${task.domain}/schema.prisma`;
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
  const scriptPath = `/var/task/scripts/${task.script}`;
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

// ─── Lambda Handler ─────────────────────────────────────────────────────────

export const handler = async () => {
  const tasksJson = process.env.INIT_TASKS;
  if (!tasksJson) {
    console.log('[init-runner] No INIT_TASKS env var — nothing to do.');
    return { statusCode: 200, body: 'No tasks configured' };
  }

  const tasks = JSON.parse(tasksJson);
  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.log('[init-runner] INIT_TASKS is empty — nothing to do.');
    return { statusCode: 200, body: 'No tasks configured' };
  }

  console.log(`[init-runner] ${tasks.length} task(s) to run:`);
  for (const t of tasks) {
    console.log(`  - ${t.name} (${t.type})`);
  }
  console.log('');

  await resolveSecrets();
  console.log('');

  const errors = [];
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
      const msg = `Task "${task.name}" (${task.type}) failed: ${err.message}`;
      console.error(`[init-runner] ✗ ${msg}`);
      errors.push(msg);
    }
  }

  if (errors.length > 0) {
    // Throwing causes Lambda to report a function error — CD workflow detects this.
    throw new Error(
      `[init-runner] ${errors.length} task(s) failed:\n${errors.join('\n')}`,
    );
  }

  console.log('\n[init-runner] All tasks completed successfully.');
  return { statusCode: 200, body: 'All tasks completed successfully' };
};
