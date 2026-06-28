#!/usr/bin/env node
/**
 * template-hygiene.mjs — Pre-publish gate for the template repository.
 *
 * Fails (exit 1) if any TRACKED git file contains:
 *   - GitHub PATs (ghp_, github_pat_, ghs_, gho_)
 *   - AWS access keys (AKIA…) or secret keys
 *   - Terraform state files (*.tfstate, *.tfstate.backup)
 *   - Real AWS account IDs (12-digit numbers in tfvars / terraform files,
 *     other than the documented placeholder 123456789012)
 *   - .code-workspace files (gitignored — should never land in tracked tree)
 *   - aws-credentials.* files other than the .example
 *
 * Run locally:  node scripts/template-hygiene.mjs
 * Wired into:   .github/workflows/ci-fast-check.yml (Run template-hygiene scan step)
 *
 * Exit codes: 0 clean · 1 violations found · 2 git not available
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Get tracked files via git ─────────────────────────────────────────────
const ls = spawnSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf-8' });
if (ls.status !== 0) {
  console.error('FATAL: `git ls-files` failed. Is this a git repository?');
  console.error(ls.stderr);
  process.exit(2);
}
const tracked = ls.stdout.split('\n').filter(Boolean);
console.log(`template-hygiene — scanning ${tracked.length} tracked files`);

// ─── Path-level deny rules ─────────────────────────────────────────────────
const DENIED_PATHS = [
  { pattern: /\.code-workspace$/, reason: 'Workspace files often contain GH_TOKEN / personal config (gitignored — must not be tracked)' },
  { pattern: /\.tfstate(\.backup)?$/, reason: 'Terraform state files contain account metadata, ARNs, and secrets' },
  { pattern: /^infra\/bootstrap\/aws-credentials(?!\.example$)/, reason: 'Real AWS credentials must never be tracked' },
  { pattern: /^infra\/bootstrap\/github-secrets(?!\.example$)/, reason: 'Real GitHub secrets must never be tracked' },
  { pattern: /^infra\/bootstrap\/terraform\.tfvars$/, reason: 'Bootstrap tfvars is gitignored — contains org/account config' },
  { pattern: /^\.env(\.local|\.gh|\.e2e|\.github-local)?$/, reason: 'Environment files must never be tracked (use .env.local.example)' },
];

// ─── Content-level deny rules ──────────────────────────────────────────────
// Each rule may include `pathFilter` to limit which tracked files we content-scan.
const CONTENT_RULES = [
  {
    name: 'GitHub PAT (classic ghp_)',
    pattern: /\bghp_[A-Za-z0-9]{30,}\b/,
  },
  {
    name: 'GitHub fine-grained PAT (github_pat_)',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/,
  },
  {
    name: 'GitHub server-to-server token (ghs_)',
    pattern: /\bghs_[A-Za-z0-9]{30,}\b/,
  },
  {
    name: 'GitHub OAuth token (gho_)',
    pattern: /\bgho_[A-Za-z0-9]{30,}\b/,
  },
  {
    name: 'AWS Access Key ID (AKIA…)',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: 'AWS Secret Access Key (long base64 with aws context)',
    // Heuristic: 40-char base64 string near "aws_secret" or "secret_access_key"
    pattern: /(?:aws_secret_access_key|secret_access_key|aws_secret)[\s"':=]+([A-Za-z0-9/+=]{40})\b/i,
  },
  {
    name: 'AWS Session Token (long base64 with aws context)',
    pattern: /(?:aws_session_token|session_token)[\s"':=]+([A-Za-z0-9/+=]{100,})\b/i,
  },
  {
    name: 'Real AWS account ID in terraform file',
    // 12-digit number in .tf or .tfvars files. Exclude:
    //   - 123456789012  documentation placeholder
    //   - 000000000000  LocalStack fake account
    //   - 901920570463  AWS-published ADOT Lambda layer publisher
    //   - 753240598075  AWS-published Lambda Web Adapter layer publisher
    // If you add another AWS-published layer, add its publisher account here.
    pattern: /\b(?!123456789012\b)(?!000000000000\b)(?!901920570463\b)(?!753240598075\b)\d{12}\b/,
    pathFilter: (p) => /\.(tf|tfvars)$/.test(p),
  },
  {
    name: 'Slack webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/,
  },
  {
    name: 'Private SSH key',
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
];

// Files we never content-scan (binaries, lockfiles, this script itself,
// the agent prompt that has to mention these patterns to validate them).
const SKIP_CONTENT_SCAN = new Set([
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'scripts/template-hygiene.mjs',  // self
  'SECURITY.md',                   // mentions patterns in documentation
]);

const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.ico', '.pdf', '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.otf',
  '.mp3', '.mp4', '.mov',
]);

function fileExt(p) {
  const i = p.lastIndexOf('.');
  return i >= 0 ? p.slice(i).toLowerCase() : '';
}

// ─── Run scan ──────────────────────────────────────────────────────────────
const violations = [];

// 1. Path-level rules
for (const file of tracked) {
  for (const rule of DENIED_PATHS) {
    if (rule.pattern.test(file)) {
      violations.push({ file, rule: `denied path: ${rule.reason}`, line: 0 });
    }
  }
}

// 2. Content-level rules
for (const file of tracked) {
  if (SKIP_CONTENT_SCAN.has(file)) continue;
  if (SKIP_EXT.has(fileExt(file))) continue;
  const full = join(ROOT, file);
  if (!existsSync(full)) continue;
  let content;
  try { content = readFileSync(full, 'utf-8'); } catch { continue; }
  // Binary sniff
  if (content.length > 0 && content.slice(0, 8192).includes('\0')) continue;

  const lines = content.split('\n');
  for (const rule of CONTENT_RULES) {
    if (rule.pathFilter && !rule.pathFilter(file)) continue;
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        violations.push({ file, rule: rule.name, line: i + 1, snippet: lines[i].trim().slice(0, 120) });
      }
    }
  }
}

// ─── Report ────────────────────────────────────────────────────────────────
if (violations.length === 0) {
  console.log('✓ template-hygiene: no violations found');
  process.exit(0);
}

console.error(`\n✗ template-hygiene: ${violations.length} violation(s) found:\n`);
for (const v of violations) {
  console.error(`  ${v.file}${v.line ? `:${v.line}` : ''}`);
  console.error(`    rule: ${v.rule}`);
  if (v.snippet) console.error(`    line: ${v.snippet}`);
  console.error('');
}
console.error('Fix: remove the file (or its sensitive content) and add a matching entry to .gitignore.');
console.error('     Then rotate any leaked credential immediately.');
process.exit(1);
