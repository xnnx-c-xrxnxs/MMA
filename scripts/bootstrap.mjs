#!/usr/bin/env node
/**
 * bootstrap.mjs — One-step project bootstrap from a template-created repo.
 *
 * Run this ONCE, immediately after creating a new repo via:
 *   gh repo create your-org/your-project --template xnnx-c-xrxnxs/mma --private --clone
 *
 * What it does, in order:
 *   1. Validates: node 24, gh CLI authed with admin on this repo, on `main`,
 *      origin remote exists, working tree clean.
 *   2. RENAMES the @mma/ scope, project name, GitHub org, CODEOWNERS team,
 *      and display strings across every source file (calls init-project.mjs
 *      with --no-git-init --no-self-delete --yes).
 *   3. DELETES examples/ (unless --keep-examples).
 *   4. COMMITS the renames + deletion as a single squash-friendly commit on
 *      `main` and pushes to origin.
 *   5. CREATES the `develop` branch from `main` and pushes it.
 *   6. APPLIES GitHub rulesets (main + develop + v* tags) and creates the
 *      `dev`, `staging`, `prod` deployment environments (calls
 *      setup-branch-protection.mjs without --rename-codeowners since
 *      init-project.mjs already rewrote it via --owner).
 *
 * What it does NOT do (run these separately, see PROJECT_BOOTSTRAP.md):
 *   • Seed GitHub issue labels (depends on issue-config.json being filled in
 *     via /sync-notebooklm-output first).
 *   • Self-delete bootstrap.mjs or init-project.mjs (safe to re-run if needed).
 *   • Add required reviewers to the `prod` environment.
 *
 * Usage:
 *   node scripts/bootstrap.mjs \
 *     --scope=@acme --name=acme-platform --owner=@acme/platform
 *
 *   node scripts/bootstrap.mjs \
 *     --scope=@acme --name=acme-platform --owner=@acme/platform \
 *     --org=Acme-Inc --display-name="Acme" --keep-examples --dry-run
 *
 * Flags:
 *   --scope=@acme            (required) New npm scope.
 *   --name=acme-platform     (required) New project name (kebab-case).
 *   --owner=@org/team        (optional) CODEOWNERS team for the new repo.
 *                            Defaults to @xnnx-c-xrxnxs/senior-devs.
 *   --org=Acme-Inc           (optional) GitHub org/user; auto-detected from
 *                            `gh repo view` when not supplied.
 *   --display-name="Acme"    (optional) Human-readable UI string. Defaults to
 *                            titleized --name.
 *   --keep-examples          Keep examples/ (default removes it).
 *   --dry-run                Print every step, mutate nothing.
 *   --yes                    Skip the confirmation prompt.
 *   --skip-rulesets          Skip phase 6 (rulesets/environments).
 *
 * Exit codes: 0 success · 1 validation/IO error · 2 user aborted.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DEFAULT_OWNER = '@xnnx-c-xrxnxs/senior-devs';

// ─── Arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { keepExamples: false, dryRun: false, yes: false, skipRulesets: false };
  // Track which `--key=value` flag last consumed a value so that bare tokens
  // (e.g. PowerShell 5.1 splits `--display-name=Masterclass Demo` into two
  // argv entries) can be re-joined as continuation of the previous value.
  let lastValueFlag = null;
  for (const raw of argv) {
    if (raw.startsWith('--scope=')) { args.scope = raw.slice(8); lastValueFlag = 'scope'; }
    else if (raw.startsWith('--name=')) { args.name = raw.slice(7); lastValueFlag = 'name'; }
    else if (raw.startsWith('--owner=')) { const v = raw.slice(8); if (v) args.owner = v; lastValueFlag = 'owner'; }
    else if (raw.startsWith('--org=')) { const v = raw.slice(6); if (v) args.org = v; lastValueFlag = 'org'; }
    else if (raw.startsWith('--display-name=')) { const v = raw.slice(15); if (v) args.displayName = v; lastValueFlag = 'displayName'; }
    else if (raw === '--keep-examples') { args.keepExamples = true; lastValueFlag = null; }
    else if (raw === '--dry-run') { args.dryRun = true; lastValueFlag = null; }
    else if (raw === '--yes' || raw === '-y') { args.yes = true; lastValueFlag = null; }
    else if (raw === '--skip-rulesets') { args.skipRulesets = true; lastValueFlag = null; }
    else if (raw === '--help' || raw === '-h') { console.log(HELP); process.exit(0); }
    else if (!raw.startsWith('--') && lastValueFlag && args[lastValueFlag]) {
      // Continuation of a previously-split `--key=value` arg. Common on
      // PowerShell 5.1, which strips quotes when forwarding to native exes.
      args[lastValueFlag] = `${args[lastValueFlag]} ${raw}`;
    }
    else { fail(`Unknown flag: ${raw}\n\n${HELP}`); }
  }
  return args;
}

const HELP = `bootstrap.mjs — one-step project bootstrap.

Required:
  --scope=@acme           New npm scope.
  --name=acme-platform    Project name (lowercase kebab-case).
  --owner=@org/team       CODEOWNERS team (default: @xnnx-c-xrxnxs/senior-devs).

Optional:
  --org=Acme-Inc          GitHub org (auto-detected from origin if omitted).
  --display-name="Acme"   UI strings (defaults to titleized --name).
  --keep-examples         Keep examples/ directory.
  --skip-rulesets         Skip the GitHub rulesets + environments phase.
  --dry-run               Show every step, mutate nothing.
  --yes                   Skip confirmation prompt.`;

// ─── Logging helpers ────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
function step(n, total, msg) { console.log(`\n${c.bold}${c.cyan}[${n}/${total}] ${msg}${c.reset}`); }
function ok(msg) { console.log(`  ${c.green}✓${c.reset} ${msg}`); }
function info(msg) { console.log(`  ${c.dim}${msg}${c.reset}`); }
function warn(msg) { console.log(`  ${c.yellow}⚠ ${msg}${c.reset}`); }
function fail(msg) { console.error(`${c.red}✗ ${msg}${c.reset}`); process.exit(1); }

// ─── Shell helpers ──────────────────────────────────────────────────────────
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf-8', cwd: ROOT, ...opts });
}
function runStrict(cmd, args, opts = {}) {
  const r = run(cmd, args, opts);
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    fail(`Command failed: ${cmd} ${args.join(' ')}`);
  }
  return r;
}
function runInherit(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
}

// ─── Validation ─────────────────────────────────────────────────────────────
function validateArgs(args) {
  const errs = [];
  if (!args.scope) errs.push('--scope is required (e.g. --scope=@acme)');
  else if (!/^@[a-z0-9][a-z0-9-]*$/.test(args.scope)) errs.push(`--scope must match /^@[a-z0-9-]+$/ (got: ${args.scope})`);
  if (!args.name) errs.push('--name is required (e.g. --name=acme-platform)');
  else if (!/^[a-z][a-z0-9-]*$/.test(args.name)) errs.push(`--name must match /^[a-z][a-z0-9-]*$/ (got: ${args.name})`);
  if (!args.owner) args.owner = DEFAULT_OWNER;
  if (!/^@[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9-]*$/.test(args.owner)) {
    errs.push(`--owner must match @org/team (got: ${args.owner})`);
  }
  if (args.org && !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(args.org)) {
    errs.push(`--org must match GitHub username/org pattern (got: ${args.org})`);
  }
  if (errs.length) { errs.forEach(e => console.error(`${c.red}✗${c.reset} ${e}`)); console.error(`\n${HELP}`); process.exit(1); }
  if (!args.displayName) {
    args.displayName = args.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}

function validateEnvironment(args) {
  // Node 24
  const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
  if (nodeMajor < 24) fail(`Node 24+ required. You have ${process.version}. Run \`nvm use\` first.`);
  ok(`Node ${process.version}`);

  // git repo
  const inRepo = run('git', ['rev-parse', '--is-inside-work-tree']);
  if (inRepo.status !== 0) fail('Not inside a git repository. Create the repo first via `gh repo create --template`.');
  ok('Inside a git repository');

  // On main
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (branch !== 'main') fail(`Expected to be on 'main', got '${branch}'. Run: git checkout main`);
  ok(`On 'main'`);

  // Origin exists
  const origin = run('git', ['remote', 'get-url', 'origin']);
  if (origin.status !== 0) fail("No 'origin' remote. Bootstrap assumes you used `gh repo create --template`.");
  const originUrl = origin.stdout.trim();
  ok(`origin = ${originUrl}`);

  // Working tree clean (allow the bootstrap.mjs script itself + .vscode to be modified during template dev — but for downstream this must be clean)
  const dirty = run('git', ['status', '--porcelain']).stdout.trim();
  if (dirty) {
    fail(`Working tree is not clean. Commit or stash first:\n${dirty}`);
  }
  ok('Working tree clean');

  // gh CLI present + authed
  const ghCheck = run('gh', ['--version']);
  if (ghCheck.status !== 0) fail('GitHub CLI (`gh`) not installed. Install: https://cli.github.com/');
  const ghAuth = run('gh', ['auth', 'status']);
  if (ghAuth.status !== 0) fail("`gh` is not authenticated. Run: gh auth login");
  ok('gh CLI authenticated');

  // Detect repo owner/name from origin
  const repoView = run('gh', ['repo', 'view', '--json', 'nameWithOwner,owner']);
  if (repoView.status !== 0) fail('Could not detect current GitHub repo. Ensure origin points to a GitHub repo you have access to.');
  const repoInfo = JSON.parse(repoView.stdout);
  const [detectedOrg] = repoInfo.nameWithOwner.split('/');
  if (!args.org) {
    args.org = detectedOrg;
    info(`org auto-detected: ${args.org}`);
  } else if (args.org !== detectedOrg) {
    warn(`--org=${args.org} but repo owner is ${detectedOrg}. URLs will use ${args.org}; rulesets target ${detectedOrg}/${repoInfo.nameWithOwner.split('/')[1]}.`);
  }
  args._repoNameWithOwner = repoInfo.nameWithOwner;
  ok(`Repo: ${args._repoNameWithOwner}`);

  // Admin permission
  const perm = run('gh', ['api', `/repos/${args._repoNameWithOwner}`, '--jq', '.permissions.admin']);
  if (perm.stdout.trim() !== 'true' && !args.skipRulesets) {
    fail(`You don't have admin on ${args._repoNameWithOwner}. Either re-auth with an admin account or pass --skip-rulesets.`);
  }
  if (!args.skipRulesets) ok(`Admin access on ${args._repoNameWithOwner}`);
}

// ─── Confirmation ───────────────────────────────────────────────────────────
async function confirm(args) {
  if (args.yes || args.dryRun) return;
  console.log(`\n${c.bold}About to bootstrap ${args._repoNameWithOwner}:${c.reset}`);
  console.log(`  • Rename @mma/  →  ${args.scope}/`);
  console.log(`  • Rename project   →  ${args.name}`);
  console.log(`  • Rename UI text   →  "${args.displayName}"`);
  console.log(`  • Rename GH org    →  ${args.org}`);
  console.log(`  • CODEOWNERS team  →  ${args.owner}`);
  console.log(`  • ${args.keepExamples ? 'KEEP' : 'DELETE'} examples/`);
  console.log(`  • Commit + push 'main'`);
  console.log(`  • Create + push 'develop'`);
  if (!args.skipRulesets) console.log(`  • Apply rulesets + create dev/staging/prod environments`);
  console.log(`\n${c.yellow}This is destructive and irreversible.${c.reset}`);
  const rl = createInterface({ input, output });
  const ans = (await rl.question('Proceed? [y/N] ')).trim().toLowerCase();
  rl.close();
  if (ans !== 'y' && ans !== 'yes') { console.log('Aborted.'); process.exit(2); }
}

// ─── Phase 1: rename via init-project.mjs ───────────────────────────────────
function phaseRename(args) {
  const initArgs = [
    'scripts/init-project.mjs',
    `--scope=${args.scope}`,
    `--name=${args.name}`,
    `--owner=${args.owner}`,
    `--org=${args.org}`,
    `--display-name=${args.displayName}`,
    '--no-git-init',
    '--no-self-delete',
    '--yes',
  ];
  if (args.keepExamples) initArgs.push('--keep-examples');
  if (args.dryRun) initArgs.push('--dry-run');
  const r = runInherit('node', initArgs);
  if (r.status !== 0) fail('init-project.mjs failed');
  ok('rename complete');
}

// ─── Phase 3: regenerate pnpm lockfile under the new scope ─────────────────
function phaseRegenerateLockfile(args) {
  if (args.dryRun) { info('[dry-run] would: pnpm install (regenerate lockfile under new scope)'); return; }
  info('rewriting pnpm-lock.yaml so workspace package names match the new scope...');
  const r = runInherit('pnpm', ['install', '--no-frozen-lockfile'], { shell: process.platform === 'win32' });
  if (r.status !== 0) fail('pnpm install failed — fix errors above and re-run');
  ok('lockfile regenerated');
}

// ─── Phase 4: commit + push main ────────────────────────────────────────────
function phaseCommitPushMain(args) {
  if (args.dryRun) { info('[dry-run] would: git add -A && git commit && git push origin main'); return; }
  runStrict('git', ['add', '-A']);
  const status = run('git', ['status', '--porcelain']).stdout.trim();
  if (!status) { info('no file changes to commit'); }
  else {
    runStrict('git', ['commit', '-m', 'chore: bootstrap project from template']);
    ok('committed rename + lockfile + examples removal');
  }
  runStrict('git', ['push', 'origin', 'main']);
  ok('pushed main to origin');
}

// ─── Phase 5: create + push develop ─────────────────────────────────────────
function phaseDevelopBranch(args) {
  if (args.dryRun) { info('[dry-run] would: create develop from main and push'); return; }

  // Check remote
  const remoteCheck = run('git', ['ls-remote', '--exit-code', '--heads', 'origin', 'develop']);
  if (remoteCheck.status === 0) { info("'develop' already exists on origin — skipping"); return; }

  // Local
  const localCheck = run('git', ['rev-parse', '--verify', '--quiet', 'refs/heads/develop']);
  if (localCheck.status !== 0) {
    runStrict('git', ['branch', 'develop', 'main']);
  }
  runStrict('git', ['push', '-u', 'origin', 'develop']);
  // Stay on main
  runStrict('git', ['checkout', 'main']);
  ok("created + pushed 'develop'");
}

// ─── Phase 6: rulesets + environments ───────────────────────────────────────
function phaseRulesets(args) {
  if (args.skipRulesets) { info('skipped (--skip-rulesets)'); return; }
  if (args.dryRun) { info('[dry-run] would: invoke setup-branch-protection.mjs'); return; }
  // CODEOWNERS already rewritten by init-project (--owner). Do NOT pass --rename-codeowners.
  const r = runInherit('node', ['scripts/task-helpers/setup-branch-protection.mjs', args._repoNameWithOwner]);
  if (r.status !== 0) fail('setup-branch-protection.mjs failed');
  ok('rulesets + environments applied');
}

// ─── Summary ────────────────────────────────────────────────────────────────
function printSummary(args) {
  console.log(`\n${c.bold}${c.green}━━━ Bootstrap complete ━━━${c.reset}`);
  if (args.dryRun) {
    console.log(`${c.yellow}This was a DRY RUN — no files changed, nothing pushed.${c.reset}`);
    return;
  }
  console.log(`\n${c.bold}Repository:${c.reset} https://github.com/${args._repoNameWithOwner}`);
  console.log(`${c.bold}Branches:${c.reset}   main, develop`);
  if (!args.skipRulesets) console.log(`${c.bold}Rulesets:${c.reset}   "Protect main + develop", "Protect v* tags"`);
  console.log(`\n${c.bold}Next steps (in order):${c.reset}`);
  console.log(`  ${c.cyan}1.${c.reset} Verify build:`);
  console.log(`        pnpm nx run-many -t build,test --skip-nx-cache`);
  console.log(`  ${c.cyan}2.${c.reset} Extract project context (10 min): see docs/NOTEBOOKLM_EXTRACTION_PROMPT.md`);
  console.log(`  ${c.cyan}3.${c.reset} In Claude Code:  /sync-notebooklm-output`);
  console.log(`        (populates .github/issue-config.json + docs/PROJECT_CONTEXT.md)`);
  console.log(`  ${c.cyan}4.${c.reset} Seed labels:  Tasks: Run Task → "GitHub: Seed Issue Labels"`);
  console.log(`  ${c.cyan}5.${c.reset} Bulk-create issues:  /import-estimate-csv  (optional, if you have a sprint sheet)`);
  console.log(`  ${c.cyan}6.${c.reset} ${c.yellow}Manual GitHub UI follow-ups${c.reset} (no stable API):`);
  console.log(`        • Add required reviewers to 'prod' environment:`);
  console.log(`          https://github.com/${args._repoNameWithOwner}/settings/environments`);
  console.log(`        • Confirm CODEOWNERS team ${args.owner} exists with write access:`);
  console.log(`          https://github.com/${args._repoNameWithOwner}/settings/access`);
  console.log('');
  console.log(`${c.dim}Full bootstrap reference: docs/PROJECT_BOOTSTRAP.md${c.reset}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);

  console.log(`${c.bold}bootstrap.mjs${c.reset} — one-step project bootstrap`);
  console.log(`${c.dim}scope=${args.scope}  name=${args.name}  owner=${args.owner}  display="${args.displayName}"${args.dryRun ? '  [DRY RUN]' : ''}${c.reset}`);

  step(1, 7, 'Validate environment');
  validateEnvironment(args);

  await confirm(args);

  step(2, 7, 'Rename scope / project / org / CODEOWNERS + (optionally) delete examples/');
  phaseRename(args);

  step(3, 7, 'Regenerate pnpm lockfile under the new scope');
  phaseRegenerateLockfile(args);

  step(4, 7, 'Commit + push main');
  phaseCommitPushMain(args);

  step(5, 7, "Create + push 'develop' branch");
  phaseDevelopBranch(args);

  step(6, 7, 'Apply rulesets + create dev/staging/prod environments');
  phaseRulesets(args);

  step(7, 7, 'Done');
  printSummary(args);
}

main().catch(err => { console.error(`${c.red}FATAL:${c.reset}`, err); process.exit(1); });
