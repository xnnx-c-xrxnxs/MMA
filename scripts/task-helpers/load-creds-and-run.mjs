#!/usr/bin/env node

/**
 * Cross-platform helper for VS Code tasks that need AWS credentials.
 *
 * Usage:
 *   node scripts/task-helpers/load-creds-and-run.mjs <env> <command...>
 *
 * Loads AWS credentials from infra/bootstrap/aws-credentials.{env}
 * (or infra/bootstrap/aws-credentials as fallback), sets them as env vars,
 * then spawns the remaining args as a child process.
 *
 * Example:
 *   node scripts/task-helpers/load-creds-and-run.mjs dev terraform -chdir=infra/bootstrap init
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const [, , credEnv, ...cmdArgs] = process.argv;

if (!credEnv || cmdArgs.length === 0) {
  console.error(
    'Usage: node scripts/task-helpers/load-creds-and-run.mjs <env> <command...>',
  );
  process.exit(1);
}

// Resolve credential file
const root = resolve(import.meta.dirname, '..', '..');
const envFile = resolve(root, `infra/bootstrap/aws-credentials.${credEnv}`);
const fallback = resolve(root, 'infra/bootstrap/aws-credentials');
const credsPath = existsSync(envFile)
  ? envFile
  : existsSync(fallback)
    ? fallback
    : null;

if (!credsPath) {
  console.error(
    `No credential file found. Copy aws-credentials.example to aws-credentials or aws-credentials.${credEnv}`,
  );
  process.exit(1);
}

console.log(`Using credentials from: ${credsPath}`);

// Parse KEY=VALUE lines (skip comments and blanks)
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

// Run the command
const cmd = cmdArgs.join(' ');
try {
  execSync(cmd, { stdio: 'inherit', env: process.env, cwd: root });
} catch (e) {
  process.exit(e.status || 1);
}
