#!/usr/bin/env node

/**
 * Cross-platform helper: triggers preview destroy workflow via gh CLI.
 *
 * Usage:
 *   node scripts/task-helpers/preview-destroy.mjs <previewName> <accountEnv>
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , previewName, accountEnv] = process.argv;

if (!previewName || !accountEnv) {
  console.error(
    'Usage: node scripts/task-helpers/preview-destroy.mjs <previewName> <accountEnv>',
  );
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..', '..');

const repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
  encoding: 'utf-8',
  cwd: root,
}).trim();

function ghVar(name, env) {
  try {
    return execSync(`gh variable get ${name} --env ${env} --repo ${repo}`, {
      encoding: 'utf-8',
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function ghVarFallback(name, env) {
  const val = ghVar(name, env);
  if (val) return val;
  try {
    return execSync(`gh variable get ${name} --repo ${repo}`, {
      encoding: 'utf-8',
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

const accountId = ghVarFallback('AWS_ACCOUNT_ID', accountEnv);
const tfBucket = ghVar('TFSTATE_BUCKET', accountEnv);
const tfTable = ghVar('TFSTATE_LOCK_TABLE', accountEnv);

console.log(`\nDestroying preview '${previewName}'`);
console.log(`  Account: ${accountId} (from ${accountEnv})\n`);

const args = [
  '-f', `preview_name=${previewName}`,
  '-f', `aws_account_id=${accountId}`,
];
if (tfBucket) args.push('-f', `tfstate_bucket=${tfBucket}`);
if (tfTable) args.push('-f', `tfstate_lock_table=${tfTable}`);

// Use current branch for workflow ref so the correct YAML is loaded
const branch = execSync('git rev-parse --abbrev-ref HEAD', {
  encoding: 'utf-8',
  cwd: root,
}).trim();

execSync(
  `gh workflow run "CD: Preview \u2014 Destroy" --ref ${branch} --repo ${repo} ${args.join(' ')}`,
  { stdio: 'inherit', env: process.env, cwd: root },
);

console.log('\nDestroy workflow triggered!');
execSync('node -e "setTimeout(()=>{},3000)"', { stdio: 'ignore' });
execSync(`gh run list --workflow="CD: Preview \u2014 Destroy" --limit 1 --repo ${repo}`, {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
});
