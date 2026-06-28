#!/usr/bin/env node

/**
 * Cross-platform helper: triggers a CD deploy workflow via gh CLI.
 *
 * Usage:
 *   node scripts/task-helpers/deploy-trigger.mjs <environment> <deployAll>
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , env, deployAll = 'false'] = process.argv;
if (!env) {
  console.error('Usage: node scripts/task-helpers/deploy-trigger.mjs <environment> [deployAll]');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..', '..');

const repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
  encoding: 'utf-8',
  cwd: root,
}).trim();

const branch = execSync('git rev-parse --abbrev-ref HEAD', {
  encoding: 'utf-8',
  cwd: root,
}).trim();

// Try environment-scoped variable first, fall back to repo-level
let accountId;
try {
  accountId = execSync(`gh variable get AWS_ACCOUNT_ID --env ${env} --repo ${repo}`, {
    encoding: 'utf-8',
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
} catch {
  // fallback
}
if (!accountId) {
  accountId = execSync(`gh variable get AWS_ACCOUNT_ID --repo ${repo}`, {
    encoding: 'utf-8',
    cwd: root,
  }).trim();
}

console.log(`\nDeploying to '${env}' from branch '${branch}'`);
console.log(`  Account: ${accountId}`);
console.log(`  Deploy all: ${deployAll}\n`);

execSync(
  `gh workflow run "CD: Deploy" --ref ${branch} --repo ${repo} -f environment=${env} -f aws_account_id=${accountId} -f deploy_all=${deployAll}`,
  { stdio: 'inherit', env: process.env, cwd: root },
);

console.log('\nWorkflow triggered!');

// Wait a moment for the run to appear
execSync('node -e "setTimeout(()=>{},3000)"', { stdio: 'ignore' });

execSync(`gh run list --workflow="CD: Deploy" --limit 1 --repo ${repo}`, {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
});

console.log(
  "\nRun 'Deploy: Status' to check progress, or 'Deploy: Logs' to stream logs.",
);
