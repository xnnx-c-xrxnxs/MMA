#!/usr/bin/env node

/**
 * Bootstrap Terraform command runner with per-env state isolation.
 * Usage: node scripts/task-helpers/bootstrap-cmd.mjs <env> <terraform-subcommand> [...args]
 *
 * Loads AWS credentials from infra/bootstrap/aws-credentials.{env} (or fallback),
 * injects -state=terraform.{env}.tfstate for stateful commands, and runs the terraform command.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , credEnv, tfCmd, ...cmdArgs] = process.argv;

if (!credEnv || !tfCmd) {
  console.error('Usage: node scripts/task-helpers/bootstrap-cmd.mjs <env> <terraform-subcommand> [...args]');
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

// Commands that require -state and environment var
const stateful = [
  'plan', 'apply', 'output', 'import', 'destroy', 'refresh', 'state', 'taint', 'untaint', 'show',
];
const stateFile = `terraform.${credEnv}.tfstate`;

let args = [`-chdir=infra/bootstrap`, tfCmd, ...cmdArgs];
if (stateful.includes(tfCmd)) {
  args.splice(2, 0, `-state=${stateFile}`); // after -chdir, before subcommand args
  // Pass the environment to Terraform so globally-unique names (S3 buckets) get suffixed
  args.push(`-var=environment=${credEnv}`);
}

const cmd = ['terraform', ...args].join(' ');
console.log(`Running: ${cmd}`);
try {
  execSync(cmd, { stdio: 'inherit', env: process.env, cwd: root });
} catch (e) {
  process.exit(e.status || 1);
}
