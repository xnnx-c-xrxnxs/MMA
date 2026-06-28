#!/usr/bin/env node
/**
 * remove-examples.mjs — Delete the examples/ reference implementation.
 *
 * Non-destructive companion to init-project.mjs. Does ONLY:
 *   1. rm -rf examples/
 *   2. Strip `- 'examples/**'` lines from .github/workflows/*.yml paths-ignore blocks.
 *
 * Does NOT touch git, does NOT rewrite source files, does NOT self-delete,
 * does NOT touch package.json / CODEOWNERS / .code-workspace.
 *
 * Usage:
 *   node scripts/remove-examples.mjs            # interactive confirm
 *   node scripts/remove-examples.mjs --yes      # skip prompt
 *   node scripts/remove-examples.mjs --dry-run  # show what would change
 *
 * Exit codes: 0 success · 1 IO error · 2 user aborted.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function parseArgs(argv) {
  const args = { dryRun: false, yes: false };
  for (const raw of argv) {
    if (raw === '--dry-run') args.dryRun = true;
    else if (raw === '--yes' || raw === '-y') args.yes = true;
    else if (raw === '--help' || raw === '-h') { printHelp(); process.exit(0); }
    else { console.error(`Unknown flag: ${raw}`); process.exit(1); }
  }
  return args;
}

function printHelp() {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf-8').split('\n').slice(2, 18).join('\n').replace(/^ \* ?/gm, ''));
}

function stripExamplesFromWorkflows(args) {
  const wfDir = join(ROOT, '.github', 'workflows');
  if (!existsSync(wfDir)) return [];
  const edited = [];
  for (const file of readdirSync(wfDir)) {
    if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
    const full = join(wfDir, file);
    const before = readFileSync(full, 'utf-8');
    const after = before
      .split('\n')
      .filter(line => !/^\s*-\s*['"]?examples\/\*\*['"]?\s*$/.test(line))
      .join('\n');
    if (after !== before) {
      if (!args.dryRun) writeFileSync(full, after, 'utf-8');
      edited.push(relative(ROOT, full));
    }
  }
  return edited;
}

async function confirm(args, examplesExists) {
  if (args.yes || args.dryRun) return true;
  const rl = createInterface({ input, output });
  console.log('\nAbout to:');
  if (examplesExists) console.log('  • DELETE examples/ directory (recursive)');
  else console.log('  • examples/ not present — nothing to delete');
  console.log("  • Strip `- 'examples/**'` lines from .github/workflows/*.yml");
  console.log('\nWill NOT touch git, source files, package.json, CODEOWNERS, or any other path.');
  const ans = (await rl.question('Proceed? [y/N] ')).trim().toLowerCase();
  rl.close();
  return ans === 'y' || ans === 'yes';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const examplesDir = join(ROOT, 'examples');
  const examplesExists = existsSync(examplesDir);

  console.log('remove-examples');
  console.log(`  dryRun         : ${args.dryRun}`);
  console.log(`  examples/ here : ${examplesExists}`);

  if (!(await confirm(args, examplesExists))) { console.log('Aborted.'); process.exit(2); }

  if (examplesExists) {
    if (!args.dryRun) rmSync(examplesDir, { recursive: true, force: true });
    console.log('[examples] removed examples/');
  } else {
    console.log('[examples] skipped (not present)');
  }

  const edited = stripExamplesFromWorkflows(args);
  if (edited.length) {
    console.log(`[workflows] stripped 'examples/**' from ${edited.length} file(s):`);
    for (const f of edited) console.log(`  - ${f}`);
  } else {
    console.log('[workflows] no paths-ignore lines to strip');
  }

  console.log(`\n${args.dryRun ? '✓ DRY RUN complete — nothing was changed.' : '✓ Done.'}`);
  if (!args.dryRun) {
    console.log('\nNext steps:');
    console.log('  1. Review the changes: git status && git diff');
    console.log('  2. Commit when ready: git add -A && git commit -m "chore: remove examples/"');
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
