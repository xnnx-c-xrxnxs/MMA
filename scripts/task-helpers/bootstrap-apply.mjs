#!/usr/bin/env node

/**
 * Wrapper for terraform apply with per-env state isolation.
 * Usage: node scripts/task-helpers/bootstrap-apply.mjs <env> [...args]
 *
 * Loads AWS credentials and runs terraform apply with -state=terraform.{env}.tfstate
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , credEnv, ...cmdArgs] = process.argv;

if (!credEnv) {
  console.error('Usage: node scripts/task-helpers/bootstrap-apply.mjs <env> [...args]');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..', '..');
const envFile = resolve(root, `infra/bootstrap/aws-credentials.${credEnv}`);
const fallback = resolve(root, 'infra/bootstrap/aws-credentials');
const credsPath = existsSync(envFile)
  ? envFile
  : existsSync(fallback)
    ? fallback
    : null;

if (!credsPath) {
  console.error(`No credential file found. Copy aws-credentials.example to aws-credentials or aws-credentials.${credEnv}`);
  process.exit(1);
}

console.log(`Using credentials from: ${credsPath}`);
const lines = readFileSync(credsPath, 'utf-8').split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx <= 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  process.env[key] = value;
}

const stateFile = `terraform.${credEnv}.tfstate`;
const args = ['-chdir=infra/bootstrap', 'apply', `-state=${stateFile}`, `-var=environment=${credEnv}`, ...cmdArgs];
const cmd = ['terraform', ...args].join(' ');
console.log(`Running: ${cmd}`);
try {
  execSync(cmd, { stdio: 'inherit', env: process.env, cwd: root });
} catch (e) {
  process.exit(e.status || 1);
}
