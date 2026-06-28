#!/usr/bin/env node

/**
 * Applies industry-standard repository rulesets + GitHub environment gates
 * to the current repo. Idempotent — safe to re-run when CI workflows change.
 *
 * Uses **GitHub Rulesets** (modern system, GA Nov 2023) instead of classic
 * branch protection. Rulesets are layerable, exportable as JSON, and provide
 * a richer audit trail for bypass events.
 *
 * What it does:
 *   1. Creates/updates 2 rulesets:
 *      - "Protect main + develop" (branch ruleset)
 *          • Require PR with ≥1 approval
 *          • Require Code Owner review
 *          • Dismiss stale approvals on new commits
 *          • Require all 4 CI status checks to pass
 *          • Require branches up-to-date before merge
 *          • Require conversation resolution
 *          • Block force-push (non_fast_forward)
 *          • Block deletion
 *          • Require linear history (squash/rebase merges only)
 *      - "Protect v* tags" (tag ruleset)
 *          • Block deletion
 *          • Block update (no moving tags)
 *      - Bypass list: empty (no one — including admins — bypasses by default)
 *   2. Creates `dev`, `staging`, `prod` GitHub environments:
 *      - prod: 5-min wait timer
 *      - staging / dev: no gate (CI is the gate)
 *   3. (Optional --rename-codeowners) Replaces `@Old-St-Labs/senior-devs`
 *      in .github/CODEOWNERS with your org/team.
 *
 * The script also prints follow-ups that must be done in the GitHub UI
 * (no stable REST API for them):
 *   - Required reviewers on the `prod` environment.
 *
 * Usage:
 *   node scripts/task-helpers/setup-branch-protection.mjs
 *   node scripts/task-helpers/setup-branch-protection.mjs owner/repo
 *   node scripts/task-helpers/setup-branch-protection.mjs --rename-codeowners
 *   node scripts/task-helpers/setup-branch-protection.mjs owner/repo --rename-codeowners
 *
 * Requires: GitHub CLI (`gh`) authenticated with admin access on the repo.
 *
 * To export the active rulesets to JSON for version control:
 *   gh api /repos/OWNER/NAME/rulesets > infra/rulesets.json
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

function safeUnlink(path) {
  try {
    unlinkSync(path);
  } catch {
    // best-effort cleanup
  }
}

// ─── Args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const renameCodeowners = args.includes('--rename-codeowners');
const repoArg = args.find((a) => !a.startsWith('--'));

// ─── Required CI status checks (must match §15 of CLAUDE.md) ──
const REQUIRED_CHECKS = [
  'Test Affected (Unit + Integration)',
  'API E2E Tests',
  'Webapp E2E Tests (Playwright)',
  'Quick Validation (Affected Only)',
];

// ─── Ruleset names (used for idempotent upsert) ────────────────────────────
const BRANCH_RULESET_NAME = 'Protect main + develop';
const TAG_RULESET_NAME = 'Protect v* tags';

// ─── Helpers ───────────────────────────────────────────────────────────────
function gh(args, opts = {}) {
  const r = spawnSync('gh', args, { encoding: 'utf-8', ...opts });
  return { ok: r.status === 0, stdout: r.stdout?.trim() ?? '', stderr: r.stderr?.trim() ?? '', status: r.status };
}

function ghJson(args) {
  const r = gh(args);
  if (!r.ok) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

function log(msg) {
  console.log(msg);
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

// ─── Pre-flight ────────────────────────────────────────────────────────────
const auth = gh(['auth', 'status']);
if (!auth.ok) fail('gh CLI is not authenticated. Run `gh auth login` first.');

let repo = repoArg;
if (!repo) {
  const view = ghJson(['repo', 'view', '--json', 'nameWithOwner']);
  if (!view?.nameWithOwner) fail('Could not detect current repo. Pass owner/repo as the first arg.');
  repo = view.nameWithOwner;
}
const [owner, name] = repo.split('/');
if (!owner || !name) fail(`Invalid repo: "${repo}". Expected format: owner/repo`);

log(`🔧 Configuring rulesets for ${owner}/${name}\n`);

// ─── Verify admin access ───────────────────────────────────────────────────
const perm = ghJson(['api', `/repos/${owner}/${name}`, '--jq', '{permissions: .permissions}']);
if (!perm?.permissions?.admin) {
  fail(`gh user does not have admin access on ${owner}/${name}. Rulesets require admin.`);
}

// ─── Ruleset upsert helper ─────────────────────────────────────────────────
function findRulesetIdByName(rulesetName) {
  const rulesets = ghJson(['api', `/repos/${owner}/${name}/rulesets`]);
  if (!Array.isArray(rulesets)) return null;
  const match = rulesets.find((r) => r.name === rulesetName);
  return match?.id ?? null;
}

function upsertRuleset(rulesetName, body) {
  const tmpPath = resolve(process.cwd(), `.tmp-ruleset-${rulesetName.replace(/[^a-z0-9]/gi, '_')}.json`);
  writeFileSync(tmpPath, JSON.stringify(body));

  const existingId = findRulesetIdByName(rulesetName);

  const r = existingId
    ? gh(['api', '--method', 'PUT', `/repos/${owner}/${name}/rulesets/${existingId}`, '--input', tmpPath])
    : gh(['api', '--method', 'POST', `/repos/${owner}/${name}/rulesets`, '--input', tmpPath]);

  safeUnlink(tmpPath);

  if (r.ok) {
    log(`  ✅ ${existingId ? 'Updated' : 'Created'} ruleset "${rulesetName}"`);
    return true;
  } else {
    log(`  ❌ Failed ruleset "${rulesetName}": ${r.stderr || r.stdout}`);
    return false;
  }
}

// ─── Branch ruleset (main + develop) ───────────────────────────────────────
log('📋 Branch ruleset:');

const branchRuleset = {
  name: BRANCH_RULESET_NAME,
  target: 'branch',
  enforcement: 'active',
  bypass_actors: [], // no bypass — even admins go through the rules
  conditions: {
    ref_name: {
      include: ['refs/heads/main', 'refs/heads/develop'],
      exclude: [],
    },
  },
  rules: [
    { type: 'deletion' },         // block branch deletion
    { type: 'non_fast_forward' }, // block force-push
    { type: 'required_linear_history' },
    {
      type: 'pull_request',
      parameters: {
        required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: true,
        require_last_push_approval: false,
        required_review_thread_resolution: true, // == required conversation resolution
        allowed_merge_methods: ['squash', 'rebase'], // disallow merge commits → preserves linear history
      },
    },
    {
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: true, // require branches up-to-date
        do_not_enforce_on_create: false,
        required_status_checks: REQUIRED_CHECKS.map((name) => ({ context: name })),
      },
    },
  ],
};

upsertRuleset(BRANCH_RULESET_NAME, branchRuleset);
log('     Targets: refs/heads/main, refs/heads/develop');
log(`     ≥1 approval, code-owner review, ${REQUIRED_CHECKS.length} required CI checks, no force-push, no deletion, linear history\n`);

// ─── Tag ruleset (v*) ──────────────────────────────────────────────────────
log('🏷️  Tag ruleset:');

const tagRuleset = {
  name: TAG_RULESET_NAME,
  target: 'tag',
  enforcement: 'active',
  bypass_actors: [],
  conditions: {
    ref_name: {
      include: ['refs/tags/v*'],
      exclude: [],
    },
  },
  rules: [
    { type: 'deletion' },         // block tag deletion
    { type: 'non_fast_forward' }, // block tag move (force-update)
    { type: 'update' },           // block any update to existing v* tags
  ],
};

upsertRuleset(TAG_RULESET_NAME, tagRuleset);
log('     Targets: refs/tags/v*');
log('     Tags cannot be deleted or moved\n');

// ─── GitHub environments ───────────────────────────────────────────────────
function configureEnvironment(env, opts) {
  const body = {
    wait_timer: opts.waitMinutes ?? 0,
    prevent_self_review: opts.preventSelfReview ?? false,
    deployment_branch_policy: null, // any branch can deploy (CI workflow controls this)
  };

  const tmpPath = resolve(process.cwd(), `.tmp-env-${env}.json`);
  writeFileSync(tmpPath, JSON.stringify(body));

  const r = gh(['api', '--method', 'PUT', `/repos/${owner}/${name}/environments/${env}`, '--input', tmpPath]);

  safeUnlink(tmpPath);

  if (r.ok) {
    log(`  ✅ Environment "${env}"${opts.waitMinutes ? ` (${opts.waitMinutes}-min wait timer)` : ''}`);
  } else {
    log(`  ❌ Failed to configure env "${env}": ${r.stderr || r.stdout}`);
  }
}

log('🌐 GitHub environments:');
configureEnvironment('dev', { waitMinutes: 0 });
configureEnvironment('staging', { waitMinutes: 0 });
configureEnvironment('prod', { waitMinutes: 5, preventSelfReview: true });
log('');
log('  ℹ️  Required reviewers must be added manually in GitHub UI:');
log(`     https://github.com/${owner}/${name}/settings/environments`);
log('     Recommended: prod = 1+ reviewer from a "release-managers" team.\n');

// ─── Optional: rename CODEOWNERS team ──────────────────────────────────────
if (renameCodeowners) {
  const codeownersPath = resolve(import.meta.dirname, '..', '..', '.github', 'CODEOWNERS');
  if (!existsSync(codeownersPath)) {
    log('⚠️  .github/CODEOWNERS not found — skipping rename.');
  } else {
    const rl = createInterface({ input, output });
    log('👥 CODEOWNERS rename:');
    log(`   The default team is @Old-St-Labs/senior-devs. Replace with your org/team.`);
    const newTeam = (await rl.question('   Enter new team (e.g. @your-org/your-team): ')).trim();
    rl.close();

    if (!newTeam.startsWith('@') || !newTeam.includes('/')) {
      log('   ❌ Invalid format. Expected @org/team. Skipping rename.\n');
    } else {
      const original = readFileSync(codeownersPath, 'utf-8');
      const updated = original.replaceAll('@Old-St-Labs/senior-devs', newTeam);
      if (updated === original) {
        log('   ℹ️  No occurrences of @Old-St-Labs/senior-devs found — nothing to rename.\n');
      } else {
        writeFileSync(codeownersPath, updated);
        log(`   ✅ Replaced @Old-St-Labs/senior-devs → ${newTeam} in .github/CODEOWNERS`);
        log('   Commit + push the change so GitHub picks it up:\n');
        log('       git add .github/CODEOWNERS');
        log('       git commit -m "chore: set CODEOWNERS team for this repo"');
        log('       git push\n');
      }
    }
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────
log('────────────────────────────────────────────────────────');
log('✅ Ruleset setup complete.\n');
log('Manual follow-ups (one-time, in GitHub UI):');
log(`  1. Add required reviewers to "prod" environment:`);
log(`     https://github.com/${owner}/${name}/settings/environments`);
log(`  2. Verify CODEOWNERS team exists in your org and has write access:`);
log(`     https://github.com/${owner}/${name}/settings/access`);
if (!renameCodeowners) {
  log(`  3. If you created this project from the template, rename the CODEOWNERS team:`);
  log(`     node scripts/task-helpers/setup-branch-protection.mjs --rename-codeowners`);
}
log('');
log('Inspect / export the active rulesets:');
log(`  gh api /repos/${owner}/${name}/rulesets`);
log('');
log('Re-run this script any time CI workflow job names change.');
