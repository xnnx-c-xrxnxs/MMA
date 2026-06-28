#!/usr/bin/env node

/**
 * Project bootstrap — create the `develop` branch from `main` and push to origin.
 *
 * Use this immediately after creating a new project from old-st-template.
 * GitHub's "Use this template" / `gh repo create --template` produces a fresh
 * repo with a single initial commit and only the `main` branch — it deliberately
 * does NOT inherit the template's branches (chore/*, feat/*, develop, etc.).
 * This is the correct behaviour for a new project, but you still need
 * `develop` to exist before branch protection rules can be applied to it.
 *
 * Why no `staging` branch?
 *   The template uses a 2-branch trunk-based flow: `develop` → `main`. The word
 *   "staging" only refers to the deployment ENVIRONMENT — the AWS account that
 *   the latest commit on `main` automatically deploys to. There is no `staging`
 *   git branch because nothing in staging is ever different from `main`.
 *   See docs/PROJECT_BOOTSTRAP.md for the full explanation.
 *
 * What it does:
 *   1. Verifies you're on `main` and the working tree is clean.
 *   2. Creates `develop` from `main` (if missing) and pushes with -u.
 *   3. Returns to `main` and prints next-step guidance.
 *
 * Idempotent — re-running on a repo that already has the branch is a no-op.
 *
 * Usage:
 *   node scripts/task-helpers/init-branches.mjs
 *
 * Requires: git authenticated against the remote (HTTPS token or SSH key).
 */

import { spawnSync } from 'node:child_process';

const BRANCHES = ['develop'];
const SOURCE_BRANCH = 'main';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf-8', ...opts });
  if (result.status !== 0 && !opts.allowFail) {
    console.error(`✗ ${cmd} ${args.join(' ')}`);
    if (result.stderr) console.error(result.stderr);
    if (result.stdout) console.error(result.stdout);
    process.exit(1);
  }
  return result;
}

function git(...args) {
  return run('git', args);
}

function gitSafe(...args) {
  return run('git', args, { allowFail: true });
}

function branchExistsLocal(name) {
  const r = gitSafe('rev-parse', '--verify', '--quiet', `refs/heads/${name}`);
  return r.status === 0;
}

function branchExistsRemote(name) {
  const r = gitSafe('ls-remote', '--exit-code', '--heads', 'origin', name);
  return r.status === 0;
}

console.log('Project bootstrap — initialising long-lived branches…\n');

// 1. Sanity checks
const currentBranch = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
if (currentBranch !== SOURCE_BRANCH) {
  console.error(`✗ Expected to be on '${SOURCE_BRANCH}', but you are on '${currentBranch}'.`);
  console.error(`  Run: git checkout ${SOURCE_BRANCH}`);
  process.exit(1);
}

const dirty = git('status', '--porcelain').stdout.trim();
if (dirty) {
  console.error('✗ Working tree is not clean. Commit or stash changes first.');
  console.error(dirty);
  process.exit(1);
}

// Make sure main is pushed
if (!branchExistsRemote(SOURCE_BRANCH)) {
  console.log(`Pushing '${SOURCE_BRANCH}' to origin…`);
  git('push', '-u', 'origin', SOURCE_BRANCH);
}

console.log(`✓ On '${SOURCE_BRANCH}', working tree clean.\n`);

// 2. Create + push each branch
for (const branch of BRANCHES) {
  if (branchExistsRemote(branch)) {
    console.log(`✓ '${branch}' already exists on origin — skipping.`);
    continue;
  }

  if (!branchExistsLocal(branch)) {
    console.log(`Creating local '${branch}' from '${SOURCE_BRANCH}'…`);
    git('branch', branch, SOURCE_BRANCH);
  }

  console.log(`Pushing '${branch}' to origin…`);
  git('push', '-u', 'origin', branch);
  console.log(`✓ '${branch}' created and pushed.\n`);
}

// 3. Return to main
git('checkout', SOURCE_BRANCH);

console.log('────────────────────────────────────────────────────────');
console.log('✓ Branches ready: main, develop');
console.log('────────────────────────────────────────────────────────\n');
console.log('Note: there is no `staging` branch — the template uses a 2-branch');
console.log('trunk-based flow. "staging" is a deployment ENVIRONMENT (AWS account)');
console.log('that `main` auto-deploys to, not a git branch.\n');
console.log('Next steps:');
console.log('  1. Run: VS Code task → "GitHub: Setup Branch Protection (Rename CODEOWNERS Team)"');
console.log('     (this applies rulesets to main + develop and creates the dev/staging/prod environments)');
console.log('  2. Run: VS Code task → "GitHub: Seed Issue Labels"');
console.log('  3. In Claude Code, run /sync-notebooklm-output to apply your project context');
console.log('');
