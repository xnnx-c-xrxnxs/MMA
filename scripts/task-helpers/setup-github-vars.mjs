#!/usr/bin/env node

/**
 * Cross-platform helper: reads Terraform bootstrap outputs and sets GitHub
 * repo-level variables via `gh variable set`.
 *
 * Usage:
 *   node scripts/task-helpers/setup-github-vars.mjs <credentialsEnv>
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , credEnv] = process.argv;
if (!credEnv) {
  console.error(
    'Usage: node scripts/task-helpers/setup-github-vars.mjs <credentialsEnv>',
  );
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..', '..');

// Load credentials
const envFile = resolve(root, `infra/bootstrap/aws-credentials.${credEnv}`);
const fallback = resolve(root, 'infra/bootstrap/aws-credentials');
const credsPath = existsSync(envFile)
  ? envFile
  : existsSync(fallback)
    ? fallback
    : null;

if (!credsPath) {
  console.error(`No credential file found.`);
  process.exit(1);
}

console.log(`Using credentials from: ${credsPath}`);
const lines = readFileSync(credsPath, 'utf-8').split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx <= 0) continue;
  process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

// Read terraform.tfvars
const tfvarsPath = resolve(root, 'infra/bootstrap/terraform.tfvars');
const tfvars = readFileSync(tfvarsPath, 'utf-8');

function extractTfVar(name) {
  const match = tfvars.match(new RegExp(`^${name}\\s*=\\s*"(.+)"`, 'm'));
  return match ? match[1] : '';
}

const region = extractTfVar('aws_region');
const projectName = extractTfVar('project_name');

// Resolve current repo to avoid multi-remote gh disambiguation prompt
const repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
  encoding: 'utf-8',
  env: process.env,
  cwd: root,
}).trim();

// Read Terraform outputs from the correct state file
const stateFile = `terraform.${credEnv}.tfstate`;
const outputsRaw = execSync(`terraform -chdir=infra/bootstrap output -state=${stateFile} -json`, {
  encoding: 'utf-8',
  env: process.env,
  cwd: root,
});
const outputs = JSON.parse(outputsRaw);

const roleArn = outputs.deploy_role_arn.value;
const accountId = roleArn.split(':')[4];
const artifactBucket = outputs.artifact_bucket_name.value;
const ecrUrl = outputs.ecr_repo_url.value;
const monitoringRoleArn = outputs.monitoring_deploy_role_arn?.value || '';
const monitoringEcrUrl = outputs.monitoring_ecr_repo_url?.value || '';

// ADOT Lambda layer ID — format: <layer-name>:<version>
// AWS publishes this layer from account 901920570463 (AWS's own account, same for all customers).
// The Terraform modules construct the full ARN using the current region + this ID automatically.
// Update when AWS releases a new version: https://aws-otel.github.io/docs/getting-started/lambda/lambda-js
// Architecture note: use 'amd64' for x86_64 Lambdas (default), 'arm64' for Graviton.
const ADOT_LAYER_ID = 'aws-otel-nodejs-amd64-ver-1-30-2:1';

console.log(`\nSetting GitHub repository variables:`);
console.log(`  PROJECT_NAME              = ${projectName}`);
console.log(`  AWS_ACCOUNT_ID            = ${accountId}`);
console.log(`  AWS_REGION                = ${region}`);
console.log(`  ARTIFACT_BUCKET           = ${artifactBucket}`);
console.log(`  ECR_REPO_URL              = ${ecrUrl}`);
console.log(`  ADOT_LAYER_ID             = ${ADOT_LAYER_ID}`);
console.log(`  MONITORING_DEPLOY_ROLE_ARN = ${monitoringRoleArn || '(not set — bootstrap has no monitoring role)'}`);
console.log(`  MONITORING_ECR_REPO_URL   = ${monitoringEcrUrl || '(not set)'}\n`);

const vars = {
  PROJECT_NAME: projectName,
  AWS_ACCOUNT_ID: accountId,
  AWS_REGION: region,
  ARTIFACT_BUCKET: artifactBucket,
  ECR_REPO_URL: ecrUrl,
  ADOT_LAYER_ID,
  ...(monitoringRoleArn ? { MONITORING_DEPLOY_ROLE_ARN: monitoringRoleArn } : {}),
  ...(monitoringEcrUrl ? { MONITORING_ECR_REPO_URL: monitoringEcrUrl } : {}),
};

for (const [key, value] of Object.entries(vars)) {
  execSync(`gh variable set ${key} --body "${value}" --repo ${repo}`, {
    stdio: 'inherit',
    env: process.env,
    cwd: root,
  });
}

console.log('\nAll GitHub repository variables set successfully.');

// ── Push SENSITIVE_VARS GitHub secret (if github-secrets file exists) ─────
// The github-secrets file is a flat KEY=VALUE file (gitignored).
// Its contents are JSON-encoded and pushed as the SENSITIVE_VARS repo secret.
// Terraform reads this via TF_VAR_sensitive_vars and merges it into the
// project-level Secrets Manager secret — accessible to all Lambdas at cold-start.
const secretsFile = resolve(root, `infra/bootstrap/github-secrets.${credEnv}`);
const secretsFallback = resolve(root, 'infra/bootstrap/github-secrets');
const secretsPath = existsSync(secretsFile)
  ? secretsFile
  : existsSync(secretsFallback)
    ? secretsFallback
    : null;

if (secretsPath) {
  const sensitiveVars = {};
  const secretLines = readFileSync(secretsPath, 'utf-8').split('\n');
  for (const line of secretLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (v) sensitiveVars[k] = v;
  }

  if (Object.keys(sensitiveVars).length > 0) {
    console.log(`\nSetting SENSITIVE_VARS GitHub secret (${Object.keys(sensitiveVars).length} key(s))...`);
    spawnSync('gh', ['secret', 'set', 'SENSITIVE_VARS', '--body', JSON.stringify(sensitiveVars), '--repo', repo], {
      stdio: 'inherit',
      env: process.env,
      cwd: root,
    });
    console.log('SENSITIVE_VARS secret set successfully.');
  } else {
    console.log('\nNo sensitive vars found in github-secrets file — SENSITIVE_VARS secret not set.');
  }
} else {
  console.log('\nNo github-secrets file found — skipping SENSITIVE_VARS secret.');
  console.log('  To add third-party API keys, copy infra/bootstrap/github-secrets.example');
  console.log('  to infra/bootstrap/github-secrets, fill in values, and re-run this task.');
}
