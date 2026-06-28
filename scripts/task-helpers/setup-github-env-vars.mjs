#!/usr/bin/env node

/**
 * Cross-platform helper: reads Terraform bootstrap outputs and sets GitHub
 * environment-scoped variables via `gh variable set --env`.
 *
 * Usage:
 *   node scripts/task-helpers/setup-github-env-vars.mjs <targetEnvironment>
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , envName] = process.argv;
if (!envName) {
  console.error(
    'Usage: node scripts/task-helpers/setup-github-env-vars.mjs <targetEnvironment>',
  );
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..', '..');

// Load credentials
const envFile = resolve(root, `infra/bootstrap/aws-credentials.${envName}`);
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

// Ensure GitHub environment exists
console.log(`Ensuring GitHub environment '${envName}' exists...`);
const repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
  encoding: 'utf-8',
  env: process.env,
  cwd: root,
}).trim();

try {
  execSync(
    `gh api --method PUT "repos/${repo}/environments/${envName}" --silent`,
    { stdio: 'inherit', env: process.env, cwd: root },
  );
} catch {
  // May fail if environment already exists — that's fine
}

console.log(`Environment '${envName}' ready.`);

// Read terraform.tfvars for region
const tfvarsPath = resolve(root, 'infra/bootstrap/terraform.tfvars');
const tfvars = readFileSync(tfvarsPath, 'utf-8');
const regionMatch = tfvars.match(/^aws_region\s*=\s*"(.+)"/m);
const region = regionMatch ? regionMatch[1] : '';


// Read Terraform outputs from the correct state file
const stateFile = `terraform.${envName}.tfstate`;
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
const monitoringEcrUrl = outputs.monitoring_ecr_repo_url?.value || '';
const tfstateBucket = outputs.state_bucket_name.value;
const tfstateTable = outputs.lock_table_name.value;

console.log(`\nSetting GitHub environment variables for '${envName}':`);
console.log(`  AWS_ACCOUNT_ID            = ${accountId}`);
console.log(`  AWS_REGION                = ${region}`);
console.log(`  ARTIFACT_BUCKET           = ${artifactBucket}`);
console.log(`  ECR_REPO_URL              = ${ecrUrl}`);
console.log(`  MONITORING_ECR_REPO_URL   = ${monitoringEcrUrl || '(not set)'}`);
console.log(`  TFSTATE_BUCKET            = ${tfstateBucket}`);
console.log(`  TFSTATE_LOCK_TABLE        = ${tfstateTable}\n`);

const vars = {
  DEPLOY_ENABLED: 'true',
  AWS_ACCOUNT_ID: accountId,
  AWS_REGION: region,
  ARTIFACT_BUCKET: artifactBucket,
  ECR_REPO_URL: ecrUrl,
  ...(monitoringEcrUrl ? { MONITORING_ECR_REPO_URL: monitoringEcrUrl } : {}),
  TFSTATE_BUCKET: tfstateBucket,
  TFSTATE_LOCK_TABLE: tfstateTable,
};

for (const [key, value] of Object.entries(vars)) {
  execSync(`gh variable set ${key} --body "${value}" --env ${envName} --repo ${repo}`, {
    stdio: 'inherit',
    env: process.env,
    cwd: root,
  });
}

console.log(
  `\nAll GitHub environment variables for '${envName}' set successfully.`,
);

// ── Push SENSITIVE_VARS GitHub secret (environment-scoped) ────────────────
// The github-secrets.{envName} file is a flat KEY=VALUE file (gitignored).
// Its contents are JSON-encoded and pushed as an environment-scoped SENSITIVE_VARS secret.
// Terraform reads this via TF_VAR_sensitive_vars and merges it into the
// project-level Secrets Manager secret — accessible to all Lambdas at cold-start.
const secretsPath = resolve(root, `infra/bootstrap/github-secrets.${envName}`);

if (existsSync(secretsPath)) {
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
    // Split out monitoring OAuth vars into a separate secret
    const MONITORING_KEYS = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REQUIRED_ORG'];
    const monitoringOAuthVars = {};
    const projectSensitiveVars = {};
    for (const [k, v] of Object.entries(sensitiveVars)) {
      if (MONITORING_KEYS.includes(k)) {
        monitoringOAuthVars[k] = v;
      } else {
        projectSensitiveVars[k] = v;
      }
    }

    if (Object.keys(projectSensitiveVars).length > 0) {
      console.log(`\nSetting SENSITIVE_VARS GitHub secret for environment '${envName}' (${Object.keys(projectSensitiveVars).length} key(s))...`);
      spawnSync('gh', ['secret', 'set', 'SENSITIVE_VARS', '--body', JSON.stringify(projectSensitiveVars), '--repo', repo, '--env', envName], {
        stdio: 'inherit',
        env: process.env,
        cwd: root,
      });
      console.log(`SENSITIVE_VARS secret set for '${envName}' successfully.`);
    }

    if (Object.keys(monitoringOAuthVars).length > 0) {
      console.log(`\nSetting MONITORING_OAUTH_VARS GitHub secret (repo-scoped, ${Object.keys(monitoringOAuthVars).length} key(s))...`);
      spawnSync('gh', ['secret', 'set', 'MONITORING_OAUTH_VARS', '--body', JSON.stringify(monitoringOAuthVars), '--repo', repo], {
        stdio: 'inherit',
        env: process.env,
        cwd: root,
      });
      console.log(`MONITORING_OAUTH_VARS secret set successfully.`);
    }
  } else {
    console.log(`\nNo sensitive vars found in github-secrets.${envName} — secrets not set.`);
  }
} else {
  console.log(`\nNo github-secrets.${envName} file found — skipping SENSITIVE_VARS secret.`);
  console.log('  To add third-party API keys, copy infra/bootstrap/github-secrets.example');
  console.log(`  to infra/bootstrap/github-secrets.${envName}, fill in values, and re-run this task.`);
}
