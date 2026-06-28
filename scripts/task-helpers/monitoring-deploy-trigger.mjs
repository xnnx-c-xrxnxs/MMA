#!/usr/bin/env node

/**
 * Cross-platform helper: triggers the CD: Monitoring Deploy workflow via gh CLI.
 *
 * Usage:
 *   node scripts/task-helpers/monitoring-deploy-trigger.mjs <environment> <deployInfra> <deployApi> <deployWebapp>
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , env, deployInfra = 'true', deployApi = 'true', deployWebapp = 'true'] = process.argv;
if (!env) {
  console.error(
    'Usage: node scripts/task-helpers/monitoring-deploy-trigger.mjs <environment> [deployInfra] [deployApi] [deployWebapp]',
  );
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

// Try to resolve monitoring ECR repo URL
let monitoringEcrRepoUrl = '';
try {
  monitoringEcrRepoUrl = execSync(`gh variable get MONITORING_ECR_REPO_URL --env ${env} --repo ${repo}`, {
    encoding: 'utf-8',
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
} catch {
  try {
    monitoringEcrRepoUrl = execSync(`gh variable get MONITORING_ECR_REPO_URL --repo ${repo}`, {
      encoding: 'utf-8',
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Will fall back to workflow-level var or empty string
  }
}

console.log(`\nDeploying monitoring to '${env}' from branch '${branch}'`);
console.log(`  Account:      ${accountId}`);
console.log(`  ECR repo:     ${monitoringEcrRepoUrl || '(from GitHub var)'}`);
console.log(`  Deploy infra: ${deployInfra}`);
console.log(`  Deploy API:   ${deployApi}`);
console.log(`  Deploy webapp: ${deployWebapp}\n`);

const fields = [
  `gh workflow run "CD: Monitoring Deploy"`,
  `--ref ${branch}`,
  `--repo ${repo}`,
  `-f environment=${env}`,
  `-f aws_account_id=${accountId}`,
  `-f deploy_infra=${deployInfra}`,
  `-f deploy_api=${deployApi}`,
  `-f deploy_webapp=${deployWebapp}`,
];
if (monitoringEcrRepoUrl) {
  fields.push(`-f monitoring_ecr_repo_url=${monitoringEcrRepoUrl}`);
}

execSync(
  fields.join(' '),
  { stdio: 'inherit', env: process.env, cwd: root },
);

console.log('\nWorkflow triggered!');

// Wait a moment for the run to appear
execSync('node -e "setTimeout(()=>{},3000)"', { stdio: 'ignore' });

execSync(`gh run list --workflow="CD: Monitoring Deploy" --limit 1 --repo ${repo}`, {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
});

console.log(
  "\nRun 'Monitoring Deploy: Status' to check progress.",
);
