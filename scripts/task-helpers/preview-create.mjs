#!/usr/bin/env node

/**
 * Cross-platform helper: triggers preview create workflow via gh CLI.
 *
 * Usage:
 *   node scripts/task-helpers/preview-create.mjs <previewName> <ref> <enableWebapp> <accountEnv>
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , previewName, ref, enableWebapp, accountEnv] =
  process.argv;

if (!previewName || !enableWebapp || !accountEnv) {
  console.error(
    'Usage: node scripts/task-helpers/preview-create.mjs <previewName> [ref] <enableWebapp> <accountEnv>',
  );
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..', '..');

const repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
  encoding: 'utf-8',
  cwd: root,
}).trim();

// If ref is "__current__", resolve current branch
const resolvedRef =
  !ref || ref === '__current__'
    ? execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf-8',
        cwd: root,
      }).trim()
    : ref;

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

console.log(`\nCreating preview '${previewName}' from branch '${resolvedRef}'`);
console.log(`  Account: ${accountId} (from ${accountEnv})`);
console.log(`  Webapp: ${enableWebapp}\n`);

const args = [
  '-f', `preview_name=${previewName}`,
  '-f', `ref=${resolvedRef}`,
  '-f', `aws_account_id=${accountId}`,
  '-f', `enable_webapp=${enableWebapp}`,
];
if (tfBucket) args.push('-f', `tfstate_bucket=${tfBucket}`);
if (tfTable) args.push('-f', `tfstate_lock_table=${tfTable}`);

execSync(
  `gh workflow run "CD: Preview \u2014 Create" --ref ${resolvedRef} --repo ${repo} ${args.join(' ')}`,
  { stdio: 'inherit', env: process.env, cwd: root },
);

console.log('\nWorkflow triggered!');
execSync('node -e "setTimeout(()=>{},3000)"', { stdio: 'ignore' });
execSync(`gh run list --workflow="CD: Preview \u2014 Create" --limit 1 --repo ${repo}`, {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
});
console.log(
  "\nRun 'Preview: Status' to watch progress, or 'Preview: Logs' to stream logs.",
);
