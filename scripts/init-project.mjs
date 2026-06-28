#!/usr/bin/env node
/**
 * init-project.mjs — One-shot template bootstrap.
 *
 * Renames the @mma/ scope, the "mma" project name, removes the
 * examples/ directory (unless --keep-examples), optionally `git init`s, then
 * SELF-DELETES along with the migration paper trail.
 *
 * Usage:
 *   node scripts/init-project.mjs --scope=@acme --name=acme-platform --org=Acme-Inc
 *   node scripts/init-project.mjs --scope=@acme --name=acme-platform --org=Acme-Inc --keep-examples
 *   node scripts/init-project.mjs --scope=@acme --name=acme --org=Acme-Inc --no-git-init --dry-run
 *
 * Flags:
 *   --scope=@acme            (required) New npm scope. Must start with '@'.
 *   --name=acme-platform     (required) New project name. Lowercase, kebab-case.
 *   --org=Acme-Inc           (optional) GitHub org/user. Replaces "xnnx-c-xrxnxs" in URLs/configs.
 *   --owner=@acme/platform   (optional) Replaces @xnnx-c-xrxnxs/senior-devs in CODEOWNERS.
 *   --display-name="Acme"    (optional) Human-readable name for UI strings (default: --name).
 *   --keep-examples          Keep examples/ directory (default: removes it).
 *   --no-git-init            Skip `git init` (default: runs it).
 *   --dry-run                Print what would change; touch nothing.
 *   --yes                    Non-interactive; skip confirmation prompt.
 *
 * Exit codes: 0 success · 1 validation/IO error · 2 user aborted.
 */

import { existsSync, readFileSync, writeFileSync, statSync, readdirSync, rmSync, renameSync, unlinkSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Files / directories we never traverse ─────────────────────────────────
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.nx', 'dist', 'build', 'coverage',
  'tmp', 'playwright-report', 'test-results', '.next', '.turbo',
]);

// Files we never modify (binary, lockfile, generated)
const SKIP_FILES = new Set([
  'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb',
]);

// Extensions safe to text-search/replace
const TEXT_EXTENSIONS = new Set([
  '.json', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
  '.md', '.mdx', '.yml', '.yaml', '.tf', '.tfvars', '.prisma',
  '.html', '.css', '.scss', '.env', '.example', '.sh', '.ps1',
]);

// ─── Arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { keepExamples: false, gitInit: true, dryRun: false, yes: false, selfDelete: true };
  for (const raw of argv) {
    if (raw.startsWith('--scope=')) args.scope = raw.slice(8);
    else if (raw.startsWith('--name=')) args.name = raw.slice(7);
    else if (raw.startsWith('--owner=')) args.owner = raw.slice(8);
    else if (raw.startsWith('--org=')) args.org = raw.slice(6);
    else if (raw.startsWith('--display-name=')) args.displayName = raw.slice(15);
    else if (raw === '--keep-examples') args.keepExamples = true;
    else if (raw === '--no-git-init') args.gitInit = false;
    else if (raw === '--no-self-delete') args.selfDelete = false;
    else if (raw === '--dry-run') args.dryRun = true;
    else if (raw === '--yes' || raw === '-y') args.yes = true;
    else if (raw === '--help' || raw === '-h') { printHelp(); process.exit(0); }
    else { console.error(`Unknown flag: ${raw}`); process.exit(1); }
  }
  return args;
}

function printHelp() {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf-8').split('\n').slice(2, 25).join('\n').replace(/^ \* ?/gm, ''));
}

function validate(args) {
  const errs = [];
  if (!args.scope) errs.push('--scope is required (e.g. --scope=@acme)');
  else if (!/^@[a-z0-9][a-z0-9-]*$/.test(args.scope)) errs.push(`--scope must match /^@[a-z0-9-]+$/ (got: ${args.scope})`);
  if (!args.name) errs.push('--name is required (e.g. --name=acme-platform)');
  else if (!/^[a-z][a-z0-9-]*$/.test(args.name)) errs.push(`--name must match /^[a-z][a-z0-9-]*$/ (got: ${args.name})`);
  if (args.owner && !/^@[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9-]*$/.test(args.owner)) {
    errs.push(`--owner must match @org/team (got: ${args.owner})`);
  }
  if (args.org && !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(args.org)) {
    errs.push(`--org must match GitHub username/org pattern (got: ${args.org})`);
  }
  if (errs.length) { errs.forEach(e => console.error(`✗ ${e}`)); process.exit(1); }
  // Default display-name to titleized --name
  if (!args.displayName) {
    args.displayName = args.name
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}

// ─── File walker ───────────────────────────────────────────────────────────
function* walk(dir, opts = {}) {
  const skipExamples = opts.skipExamples ?? false;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (skipExamples && dir === ROOT && entry.name === 'examples') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full, opts);
    else if (entry.isFile()) yield full;
  }
}

function isTextFile(path) {
  const name = basename(path);
  if (SKIP_FILES.has(name)) return false;
  // Files with no extension we want to touch
  if (name === 'CODEOWNERS' || name === 'Dockerfile' || name === '.gitignore' || name === '.nxignore' || name === '.dockerignore' || name === '.prettierrc') return true;
  const ext = name.includes('.') ? '.' + name.split('.').slice(1).join('.') : '';
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Multi-dot extensions (.env.local, .env.example, .stories.tsx covered above)
  const lastExt = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  return TEXT_EXTENSIONS.has(lastExt);
}

// ─── Replacements ──────────────────────────────────────────────────────────
function buildReplacements(args) {
  const newScope = args.scope.replace(/^@/, ''); // 'acme'
  const reps = [
    // Order matters: more specific patterns first.
    { pattern: /@mma\//g, replacement: `@${newScope}/`, label: '@mma/ scope' },
    // Project-name URLs/strings (broad scan — catches issue templates, docs, terraform tfvars)
    { pattern: /mma/g, replacement: args.name, label: 'mma name' },
    // Display-name rewrites (UI strings shown to end users)
    { pattern: /Welcome to Mma Admin/g, replacement: `Welcome to ${args.displayName} Admin`, label: 'webapp dashboard title' },
    { pattern: /Welcome to Mma Mobile/g, replacement: `Welcome to ${args.displayName} Mobile`, label: 'mobile dashboard title' },
  ];
  if (args.org) {
    // Rewrite the GitHub org/user name. Done last so it doesn't mangle @xnnx-c-xrxnxs/team
    // refs (which the CODEOWNERS pass handles via --owner).
    reps.push({ pattern: /xnnx-c-xrxnxs/g, replacement: args.org, label: 'GitHub org name' });
  }
  // Bare "mma" (lowercase) — used in terraform project_name. Done LAST so it doesn't
  // collide with "mma" or "mma-labs" handled above.
  reps.push({ pattern: /\bold-st\b/g, replacement: args.name, label: 'bare mma token' });
  return reps;
}

function applyReplacementsToFile(path, replacements, args) {
  let content;
  try { content = readFileSync(path, 'utf-8'); } catch { return { changed: false, hits: 0 }; }
  // Quick binary sniff: if the first 8KB contain a NUL byte, skip.
  if (content.length > 0 && content.slice(0, 8192).includes('\0')) return { changed: false, hits: 0 };

  let next = content;
  let hits = 0;
  for (const { pattern, replacement } of replacements) {
    const before = next;
    next = next.replace(pattern, replacement);
    if (next !== before) hits += (before.match(pattern) || []).length;
  }
  if (next === content) return { changed: false, hits: 0 };
  if (!args.dryRun) writeFileSync(path, next, 'utf-8');
  return { changed: true, hits };
}

// ─── Project-name surfaces — package.json gets extra handling ──────────────
function renameNameSurfaces(args) {
  const replaced = [];
  // package.json: rename root package + handle @mma/source
  const pkgPath = join(ROOT, 'package.json');
  if (existsSync(pkgPath)) {
    const before = readFileSync(pkgPath, 'utf-8');
    let after = before.replace(/mma/g, args.name);
    after = after.replace(/"@mma\/source"/g, `"@${args.scope.replace(/^@/, '')}/source"`);
    if (after !== before) {
      if (!args.dryRun) writeFileSync(pkgPath, after, 'utf-8');
      replaced.push('package.json');
    }
  }

  // Rename the .code-workspace file (if it exists locally — gitignored)
  const oldWs = join(ROOT, 'mma.code-workspace');
  const newWs = join(ROOT, `${args.name}.code-workspace`);
  if (existsSync(oldWs)) {
    const before = readFileSync(oldWs, 'utf-8');
    // Strip any literal GH_TOKEN value (defensive — file is gitignored but local copies
    // may contain real PATs from template maintainers).
    let after = before.replace(/mma/g, args.name);
    after = after.replace(/("GH_TOKEN"\s*:\s*")(github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+|ghs_[A-Za-z0-9]+)"/g, '$1"');
    if (!args.dryRun) {
      writeFileSync(oldWs, after, 'utf-8');
      renameSync(oldWs, newWs);
    }
    replaced.push(`mma.code-workspace → ${args.name}.code-workspace`);
  }
  return replaced;
}

// ─── CODEOWNERS team rewrite ───────────────────────────────────────────────
function rewriteCodeowners(args) {
  const path = join(ROOT, '.github', 'CODEOWNERS');
  if (!existsSync(path) || !args.owner) return null;
  const before = readFileSync(path, 'utf-8');
  // Match either the original "@xnnx-c-xrxnxs/senior-devs" OR the post-org-rewrite
  // "@<org>/senior-devs" form (in case --org has already been applied).
  const orgPart = args.org ? `(?:xnnx-c-xrxnxs|${args.org.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})` : 'xnnx-c-xrxnxs';
  const re = new RegExp(`@${orgPart}\\/senior-devs`, 'g');
  const after = before.replace(re, args.owner);
  if (after === before) return null;
  if (!args.dryRun) writeFileSync(path, after, 'utf-8');
  return path;
}

// ─── Examples removal ──────────────────────────────────────────────────────
function removeExamples(args) {
  const examplesDir = join(ROOT, 'examples');
  if (!existsSync(examplesDir)) return false;
  if (!args.dryRun) rmSync(examplesDir, { recursive: true, force: true });

  // Strip `paths-ignore: examples/**` lines from CI workflows
  const wfDir = join(ROOT, '.github', 'workflows');
  if (existsSync(wfDir)) {
    for (const file of readdirSync(wfDir)) {
      if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
      const full = join(wfDir, file);
      const before = readFileSync(full, 'utf-8');
      const after = before
        .split('\n')
        .filter(line => !/^\s*-\s*['"]?examples\/\*\*['"]?\s*$/.test(line))
        .join('\n');
      if (after !== before && !args.dryRun) writeFileSync(full, after, 'utf-8');
    }
  }
  return true;
}

// ─── Git init + self-delete ────────────────────────────────────────────────
function gitInit(args) {
  if (args.dryRun) return { ok: true };
  const env = { ...process.env };
  // If there's already a .git, remove it (the template's history shouldn't follow new projects).
  const gitDir = join(ROOT, '.git');
  if (existsSync(gitDir)) rmSync(gitDir, { recursive: true, force: true });
  const init = spawnSync('git', ['init'], { cwd: ROOT, env, stdio: 'inherit' });
  if (init.status !== 0) return { ok: false, msg: 'git init failed' };
  spawnSync('git', ['add', '.'], { cwd: ROOT, env, stdio: 'inherit' });
  const commit = spawnSync('git', ['commit', '-m', 'chore: initialize project from template'], { cwd: ROOT, env, stdio: 'inherit' });
  return { ok: commit.status === 0 };
}

function selfDelete(args) {
  // Files to delete
  const fileTargets = [
    join(__dirname, 'init-project.mjs'),
    join(__dirname, 'init-project.spec.mjs'),
  ];
  // Directories to nuke (template-maintainer scratch space — never useful for downstream)
  const dirTargets = [
    join(ROOT, 'tmp'),
  ];
  const removed = [];
  for (const t of fileTargets) {
    if (!existsSync(t)) continue;
    if (!args.dryRun) {
      try { unlinkSync(t); removed.push(relative(ROOT, t)); } catch (e) { console.warn(`! could not delete ${t}: ${e.message}`); }
    } else {
      removed.push(relative(ROOT, t));
    }
  }
  for (const t of dirTargets) {
    if (!existsSync(t)) continue;
    if (!args.dryRun) {
      try { rmSync(t, { recursive: true, force: true }); removed.push(relative(ROOT, t) + '/'); } catch (e) { console.warn(`! could not delete ${t}: ${e.message}`); }
    } else {
      removed.push(relative(ROOT, t) + '/');
    }
  }
  return removed;
}

// ─── Confirmation prompt ───────────────────────────────────────────────────
async function confirm(args) {
  if (args.yes || args.dryRun) return true;
  const rl = createInterface({ input, output });
  console.log('\nAbout to:');
  console.log(`  • Replace "@mma/" → "${args.scope}/" in all source files`);
  console.log(`  • Replace "mma" → "${args.name}" everywhere`);
  console.log(`  • Replace "Welcome to Old ST …" → "Welcome to ${args.displayName} …" in webapp/mobile`);
  if (args.org) console.log(`  • Replace "xnnx-c-xrxnxs" → "${args.org}" in URLs/configs`);
  console.log(`  • Replace bare "mma" → "${args.name}" (terraform project_name etc.)`);
  if (args.owner) console.log(`  • Rewrite CODEOWNERS team → ${args.owner}`);
  if (!args.keepExamples) console.log('  • DELETE examples/ directory');
  if (args.gitInit) console.log('  • Re-initialize git history');
  console.log('  • DELETE init-project.mjs, MIGRATION_*.md, tmp/');
  console.log('\nThis is destructive and irreversible.');
  const ans = (await rl.question('Proceed? [y/N] ')).trim().toLowerCase();
  rl.close();
  return ans === 'y' || ans === 'yes';
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  validate(args);

  console.log('init-project — bootstrap from template');
  console.log(`  scope        : ${args.scope}`);
  console.log(`  name         : ${args.name}`);
  console.log(`  displayName  : ${args.displayName}`);
  console.log(`  org          : ${args.org ?? '(unchanged — pass --org=YourOrg to rewrite GitHub URLs)'}`);
  console.log(`  owner        : ${args.owner ?? '(unchanged — edit CODEOWNERS manually)'}`);
  console.log(`  keepExamples : ${args.keepExamples}`);
  console.log(`  gitInit      : ${args.gitInit}`);
  console.log(`  dryRun       : ${args.dryRun}`);

  if (!(await confirm(args))) { console.log('Aborted.'); process.exit(2); }

  // 1. CODEOWNERS team rewrite — must run BEFORE the broad scan so the team
  //    pattern "@xnnx-c-xrxnxs/senior-devs" is still intact when we match it.
  const co = rewriteCodeowners(args);
  if (co) console.log(`[owner] rewrote ${relative(ROOT, co)}`);
  else if (!args.owner) console.log(`[owner] skipped (pass --owner=@org/team to rewrite CODEOWNERS)`);

  // 2. Scope/name/org/display-name rewrite across all source files
  const replacements = buildReplacements(args);
  let totalFiles = 0, totalHits = 0;
  for (const file of walk(ROOT, { skipExamples: !args.keepExamples })) {
    if (!isTextFile(file)) continue;
    const { changed, hits } = applyReplacementsToFile(file, replacements, args);
    if (changed) { totalFiles++; totalHits += hits; }
  }
  console.log(`\n[scope] rewrote tokens in ${totalFiles} files (${totalHits} occurrences)`);

  // 3. Project-name surfaces (package.json + .code-workspace rename)
  const renamed = renameNameSurfaces(args);
  console.log(`[name]  renamed ${renamed.length} surfaces:${renamed.length ? '\n  - ' + renamed.join('\n  - ') : ''}`);

  // 4. Examples
  if (!args.keepExamples) {
    if (removeExamples(args)) console.log('[examples] removed examples/ + stripped paths-ignore from workflows');
  } else {
    console.log('[examples] kept (--keep-examples)');
  }

  // 5. Git init
  if (args.gitInit) {
    const r = gitInit(args);
    console.log(r.ok ? '[git] initialized + first commit' : `[git] ${r.msg ?? 'failed'}`);
  } else {
    console.log('[git] skipped (--no-git-init)');
  }

  // 6. Self-delete (skipped when called by bootstrap.mjs via --no-self-delete)
  if (args.selfDelete) {
    const deleted = selfDelete(args);
    console.log(`[cleanup] removed ${deleted.length} template-internal files:${deleted.length ? '\n  - ' + deleted.join('\n  - ') : ''}`);
  } else {
    console.log('[cleanup] skipped (--no-self-delete)');
  }

  console.log(`\n${args.dryRun ? '✓ DRY RUN complete — nothing was changed.' : '✓ Project initialized.'}`);
  if (!args.dryRun) {
    console.log('\nNext steps:');
    console.log('  1. Review .github/CODEOWNERS and update remaining team references if any');
    console.log('  2. Review the workspace file — if it contains a real PAT, rotate it');
    console.log('  3. Run: pnpm install');
    console.log('  4. Run: pnpm nx run-many -t build,test --skip-nx-cache');
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
