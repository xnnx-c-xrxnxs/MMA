#!/usr/bin/env node
/**
 * init-project.spec.mjs — Smoke test for init-project.mjs.
 *
 * Copies the template repo to a temp dir, runs init-project.mjs with synthetic
 * args + --no-git-init, asserts the post-state is correct, then cleans up.
 *
 * Wired into ci-fast-check.yml.
 *
 * Usage:
 *   node scripts/init-project.spec.mjs
 *   node scripts/init-project.spec.mjs --keep-tmp   # leave temp dir for inspection
 *
 * Exit codes: 0 success · 1 failure
 */

import { mkdirSync, mkdtempSync, cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const KEEP = process.argv.includes('--keep-tmp');

const failures = [];
function check(label, fn) {
  try { fn(); console.log(`  ✓ ${label}`); }
  catch (err) { failures.push(label); console.log(`  ✗ ${label}\n      ${err.message}`); }
}

console.log('init-project.spec — copying template to temp dir...');
const tmp = mkdtempSync(join(tmpdir(), 'init-project-spec-'));
console.log(`  temp dir: ${tmp}`);

cpSync(ROOT, tmp, {
  recursive: true,
  filter: (src) => {
    const skip = ['node_modules', '.git', '.nx', 'dist', 'build', 'coverage', 'tmp', 'playwright-report', 'test-results', '.next', '.turbo'];
    return !skip.some(s => src.endsWith(`${join('', s)}`) || src.includes(`${join('', s)}${process.platform === 'win32' ? '\\' : '/'}`));
  },
});

console.log('\ninit-project.spec — running init-project.mjs --scope=@acme --name=acmeapp ...');
const initResult = spawnSync('node', [
  'scripts/init-project.mjs',
  '--scope=@acme',
  '--name=acmeapp',
  '--owner=@acme/platform',
  '--org=Acme-Inc',
  '--display-name=Acme',
  '--no-git-init',
  '--yes',
], { cwd: tmp, stdio: 'inherit' });

if (initResult.status !== 0) {
  console.error(`\nFATAL: init-project.mjs exited with code ${initResult.status}`);
  if (!KEEP) rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}

console.log('\ninit-project.spec — verifying post-state ...');

// 1. Root package.json: name + scope rewritten
check('root package.json renamed', () => {
  const pkg = JSON.parse(readFileSync(join(tmp, 'package.json'), 'utf-8'));
  if (pkg.name !== '@acme/source') throw new Error(`expected name=@acme/source, got ${pkg.name}`);
});

// 2. tsconfig.base.json: paths use new scope
check('tsconfig.base.json paths use @acme/', () => {
  const content = readFileSync(join(tmp, 'tsconfig.base.json'), 'utf-8');
  if (content.includes('@old-st/')) throw new Error('tsconfig.base.json still contains @old-st/');
  if (!content.includes('@acme/')) throw new Error('tsconfig.base.json missing @acme/');
});

// 3. No source file imports @old-st/
check('no source files import @old-st/', () => {
  const matches = [];
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', '.nx', 'dist', 'coverage', 'tmp', 'examples'].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (entry.isFile() && /\.(ts|tsx|mjs|js)$/.test(entry.name)) {
        const c = readFileSync(full, 'utf-8');
        if (/@old-st\//.test(c)) matches.push(full.replace(tmp, ''));
      }
    }
  }
  scan(tmp);
  if (matches.length) throw new Error(`${matches.length} files still reference @old-st/:\n      ${matches.slice(0, 5).join('\n      ')}`);
});

// 4. examples/ deleted (default behavior)
check('examples/ removed', () => {
  if (existsSync(join(tmp, 'examples'))) throw new Error('examples/ still exists');
});

// 5. CODEOWNERS rewritten
check('CODEOWNERS team rewritten', () => {
  const content = readFileSync(join(tmp, '.github', 'CODEOWNERS'), 'utf-8');
  if (content.includes('@Old-St-Labs/senior-devs')) throw new Error('CODEOWNERS still references @Old-St-Labs/senior-devs');
  if (!content.includes('@acme/platform')) throw new Error('CODEOWNERS missing @acme/platform');
});

// 6. .code-workspace renamed
check('.code-workspace renamed', () => {
  if (existsSync(join(tmp, 'old-st-template.code-workspace'))) throw new Error('old-st-template.code-workspace still exists');
  if (!existsSync(join(tmp, 'acmeapp.code-workspace'))) throw new Error('acmeapp.code-workspace not created');
});

// 7. README.md mentions new name (sanity)
check('README.md references new project name', () => {
  const readme = readFileSync(join(tmp, 'README.md'), 'utf-8');
  if (readme.includes('old-st-template')) throw new Error('README.md still references old-st-template');
});

// 8. Self-delete: init-project.mjs gone
check('init-project.mjs self-deleted', () => {
  if (existsSync(join(tmp, 'scripts', 'init-project.mjs'))) throw new Error('init-project.mjs not deleted');
});

// 9. Workflows: paths-ignore: examples/** lines stripped
check('CI workflows stripped of examples/** paths-ignore', () => {
  const wfDir = join(tmp, '.github', 'workflows');
  if (!existsSync(wfDir)) return; // ok
  for (const f of readdirSync(wfDir)) {
    if (!f.endsWith('.yml')) continue;
    const c = readFileSync(join(wfDir, f), 'utf-8');
    if (/^\s*-\s*['"]?examples\/\*\*['"]?\s*$/m.test(c)) throw new Error(`${f} still has examples/** paths-ignore line`);
  }
});

// 10. tmp/ directory removed
check('tmp/ directory removed', () => {
  if (existsSync(join(tmp, 'tmp'))) throw new Error('tmp/ still exists');
});

// 11. "Old-St-Labs" rewritten when --org passed
check('Old-St-Labs replaced with --org value in issue templates', () => {
  const cfg = join(tmp, '.github', 'ISSUE_TEMPLATE', 'config.yml');
  if (!existsSync(cfg)) return;
  const c = readFileSync(cfg, 'utf-8');
  if (/Old-St-Labs/.test(c)) throw new Error(`config.yml still references Old-St-Labs`);
  if (!/Acme-Inc/.test(c)) throw new Error(`config.yml missing Acme-Inc`);
});

// 12. Display name rewritten in webapp dashboard
check('webapp dashboard "Welcome to ..." rewritten', () => {
  const p = join(tmp, 'apps', 'webapp', 'src', 'app', '(protected)', 'page.tsx');
  if (!existsSync(p)) return;
  const c = readFileSync(p, 'utf-8');
  if (/Welcome to Old ST/.test(c)) throw new Error('webapp page.tsx still says "Welcome to Old ST"');
  if (!/Welcome to Acme Admin/.test(c)) throw new Error('webapp page.tsx missing "Welcome to Acme Admin"');
});

// 13. Display name rewritten in mobile dashboard
check('mobile dashboard "Welcome to ..." rewritten', () => {
  const p = join(tmp, 'apps', 'mobile', 'src', 'app', '(tabs)', 'index.tsx');
  if (!existsSync(p)) return;
  const c = readFileSync(p, 'utf-8');
  if (/Welcome to Old ST/.test(c)) throw new Error('mobile index.tsx still says "Welcome to Old ST"');
  if (!/Welcome to Acme Mobile/.test(c)) throw new Error('mobile index.tsx missing "Welcome to Acme Mobile"');
});

// 14. terraform monitoring tfvars project_name rewritten (bare "old-st" handling)
check('terraform monitoring tfvars project_name rewritten', () => {
  const p = join(tmp, 'infra', 'environments', 'monitoring', 'terraform.tfvars');
  if (!existsSync(p)) return;
  const c = readFileSync(p, 'utf-8');
  if (/project_name\s*=\s*"old-st"/.test(c)) throw new Error('monitoring/terraform.tfvars still has project_name = "old-st"');
  if (!/project_name\s*=\s*"acmeapp"/.test(c)) throw new Error('monitoring/terraform.tfvars missing project_name = "acmeapp"');
});

// ─── Cleanup ────────────────────────────────────────────────────────────────
if (KEEP) {
  console.log(`\n  (kept temp dir: ${tmp})`);
} else {
  rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\n✓ All init-project smoke checks passed.');
