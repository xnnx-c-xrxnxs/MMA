#!/usr/bin/env node

/**
 * Cross-platform helper: triggers the CD Destroy Environment workflow via gh CLI.
 *
 * Usage:
 *   node scripts/task-helpers/env-destroy.mjs <environment>
 *
 * Safeguards:
 *   - Prompts the user to type the environment name to confirm
 *   - Requires a second confirmation for prod
 */

import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

const [, , env] = process.argv;
if (!env || !['dev', 'staging', 'prod'].includes(env)) {
  console.error('Usage: node scripts/task-helpers/env-destroy.mjs <dev|staging|prod>');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..', '..');

const repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
  encoding: 'utf-8',
  cwd: root,
}).trim();

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Confirmation ──────────────────────────────────────────────────────────────

console.log(`\n⚠️  You are about to DESTROY the '${env}' environment.`);
console.log('   This will delete ALL AWS resources (Lambda, DynamoDB, SQS, Aurora, ECS, etc.).\n');

const confirmation = await ask(`Type '${env}' to confirm: `);
if (confirmation !== env) {
  console.error(`\nAborted — you typed '${confirmation}', expected '${env}'.`);
  process.exit(1);
}

let confirmProd = false;
if (env === 'prod') {
  console.log('\n🚨 THIS IS PRODUCTION — all data will be permanently lost.');
  const prodConfirm = await ask("Type 'yes-destroy-prod' to proceed: ");
  if (prodConfirm !== 'yes-destroy-prod') {
    console.error('\nAborted — production destroy not confirmed.');
    process.exit(1);
  }
  confirmProd = true;
}

// ── Resolve AWS Account ID ──────────────────────────────────────────────────

let accountId;
try {
  accountId = execSync(`gh variable get AWS_ACCOUNT_ID --env ${env} --repo ${repo}`, {
    encoding: 'utf-8',
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
} catch {
  // fallback to repo-level
}
if (!accountId) {
  try {
    accountId = execSync(`gh variable get AWS_ACCOUNT_ID --repo ${repo}`, {
      encoding: 'utf-8',
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    console.error('Could not resolve AWS_ACCOUNT_ID from GitHub variables.');
    process.exit(1);
  }
}

// ── Resolve branch ──────────────────────────────────────────────────────────

const branch = execSync('git rev-parse --abbrev-ref HEAD', {
  encoding: 'utf-8',
  cwd: root,
}).trim();

// ── Trigger workflow ────────────────────────────────────────────────────────

console.log(`\nDestroying '${env}' environment...`);
console.log(`  Account: ${accountId}`);
console.log(`  Branch:  ${branch}\n`);

const fields = [
  `-f environment=${env}`,
  `-f confirm_environment=${env}`,
  `-f aws_account_id=${accountId}`,
  confirmProd ? '-f confirm_prod_destroy=true' : '',
].filter(Boolean).join(' ');

execSync(
  `gh workflow run "CD: Destroy Environment" --ref ${branch} --repo ${repo} ${fields}`,
  { stdio: 'inherit', env: process.env, cwd: root },
);

console.log('\nDestroy workflow triggered!');

// Wait for the run to appear
execSync('node -e "setTimeout(()=>{},3000)"', { stdio: 'ignore' });

execSync(`gh run list --workflow="CD: Destroy Environment" --limit 1 --repo ${repo}`, {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
});
