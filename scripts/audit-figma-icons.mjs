#!/usr/bin/env node
/**
 * audit-figma-icons.mjs — Figma icon usage auditor for @mma/ui
 * ═══════════════════════════════════════════════════════════════════
 * Scans one or more Figma design files for icon component instances,
 * then diffs them against the current @mma/ui icon barrel.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   pnpm figma:audit-icons
 *   pnpm figma:audit-icons --files TTph7X2aisVhdyb7Yos52X,w0CskJhTStXlnPDMxntFu9
 *   pnpm figma:audit-icons --pattern "icon"
 *   pnpm figma:audit-icons --raw        (dump all matched instance names, no normalisation)
 *
 * ── Requires ─────────────────────────────────────────────────────────────────
 *   FIGMA_ACCESS_TOKEN  in .env.local  (Figma personal access token)
 *   FIGMA_AUDIT_FILES   in .env.local  (comma-separated file keys, optional — overridden by --files)
 *
 * ── Output ───────────────────────────────────────────────────────────────────
 *   ✓ already in barrel   — used in Figma AND exported from @mma/ui ✓
 *   ✗ missing from barrel — used in Figma but NOT in the barrel (add these)
 *   ~ unused in Figma     — in the barrel but not found in any scanned file
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BARREL_PATH = resolve(ROOT, 'packages/ui/src/icons/index.ts');

// ─── Load .env.local ──────────────────────────────────────────────────────────
try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
    }
  }
} catch {
  // .env.local is optional
}

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1] ?? true;
};

const rawMode = args.includes('--raw');
const patternArg = flag('--pattern') ?? 'icon';
const filesArg = flag('--files') ?? process.env.FIGMA_AUDIT_FILES ?? '';
const PATTERN = new RegExp(patternArg, 'i');

const FILE_KEYS = filesArg
  ? filesArg.split(',').map((k) => k.trim()).filter(Boolean)
  : [];

const TOKEN = process.env.FIGMA_ACCESS_TOKEN;

if (!TOKEN) {
  console.error(
    '✗  FIGMA_ACCESS_TOKEN is not set.\n' +
    '   Add it to .env.local:\n' +
    '   FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxx\n' +
    '   Get yours at: figma.com/settings → Personal access tokens',
  );
  process.exit(1);
}

if (FILE_KEYS.length === 0) {
  console.error(
    '✗  No file keys provided.\n' +
    '   Pass --files TTph7X2aisVhdyb7Yos52X,w0CskJhTStXlnPDMxntFu9\n' +
    '   or set FIGMA_AUDIT_FILES in .env.local',
  );
  process.exit(1);
}

// ─── Figma REST helpers ───────────────────────────────────────────────────────
async function figmaGet(path) {
  const url = `https://api.figma.com/v1${path}`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': TOKEN } });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('Retry-After') ?? '10', 10);
    console.warn(`  rate-limited — waiting ${retry}s…`);
    await new Promise((r) => setTimeout(r, retry * 1000));
    return figmaGet(path);
  }
  if (!res.ok) {
    throw new Error(`Figma API ${res.status}: ${url}\n${await res.text()}`);
  }
  return res.json();
}

// ─── Node tree walker (iterative BFS — safe for large files) ──────────────────
function collectInstances(rootNode, pattern) {
  const found = new Set();
  const queue = [rootNode];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node.type === 'INSTANCE') {
      const name = node.name ?? '';
      if (pattern.test(name)) {
        found.add(name);
      }
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) queue.push(child);
    }
  }
  return found;
}

// ─── Name normalisation ───────────────────────────────────────────────────────
// "Arrow Left"        → ArrowLeftIcon
// "arrow-left"        → ArrowLeftIcon
// "Icons/Arrow Left"  → ArrowLeftIcon   (strips any prefix before last "/")
// "ArrowLeftIcon"     → ArrowLeftIcon   (already correct, not doubled)
function normalise(figmaName) {
  const part = figmaName.split('/').pop().trim();
  const pascal = part
    .split(/[-_\s/,]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return pascal.endsWith('Icon') ? pascal : `${pascal}Icon`;
}

// ─── Parse barrel — extract exported icon names ───────────────────────────────
function parseBarrel() {
  const src = readFileSync(BARREL_PATH, 'utf8');
  // Match PascalCase names ending in Icon inside export { ... } blocks
  const matches = [...src.matchAll(/\b([A-Z][A-Za-z]+Icon)\b/g)];
  return new Set(matches.map((m) => m[1]));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\nfigma:audit-icons — scanning ${FILE_KEYS.length} file(s)…`);
  console.log(`  pattern: ${PATTERN}  |  barrel: packages/ui/src/icons/index.ts\n`);

  const allRawNames = new Set();

  for (const fileKey of FILE_KEYS) {
    console.log(`  ↓ fetching file ${fileKey}…`);
    let data;
    try {
      data = await figmaGet(`/files/${fileKey}`);
    } catch (err) {
      console.error(`  ✗ failed to fetch ${fileKey}: ${err.message}`);
      continue;
    }

    const fileName = data.name ?? fileKey;
    const document = data.document;
    if (!document) {
      console.warn(`  ⚠ no document node in ${fileKey} — skipping`);
      continue;
    }

    const found = collectInstances(document, PATTERN);
    console.log(`    ${fileName}: ${found.size} icon instance(s) found`);
    for (const name of found) allRawNames.add(name);
  }

  if (allRawNames.size === 0) {
    console.log('\n⚠  No icon instances found across scanned files.');
    console.log('   Try --pattern with a different keyword (e.g. --pattern "arrow")');
    console.log('   or --raw to dump ALL instance names regardless of pattern.\n');
    process.exit(0);
  }

  if (rawMode) {
    console.log(`\n── Raw instance names (${allRawNames.size}) ─────────────────\n`);
    for (const name of [...allRawNames].sort()) {
      console.log(`  ${name}`);
    }
    process.exit(0);
  }

  // Normalise → PascalCaseIcon
  const figmaIcons = new Set([...allRawNames].map(normalise));

  // Parse barrel
  const barrelIcons = parseBarrel();

  // Diff
  const inBoth = [...figmaIcons].filter((n) => barrelIcons.has(n)).sort();
  const missingFromBarrel = [...figmaIcons].filter((n) => !barrelIcons.has(n)).sort();
  const unusedInFigma = [...barrelIcons].filter((n) => !figmaIcons.has(n)).sort();

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ICON AUDIT RESULTS`);
  console.log(`${'═'.repeat(60)}\n`);

  console.log(`  Unique icon names in Figma:    ${figmaIcons.size}`);
  console.log(`  Currently in barrel:           ${barrelIcons.size}`);
  console.log(`  ✓ already in barrel:           ${inBoth.length}`);
  console.log(`  ✗ missing from barrel:         ${missingFromBarrel.length}`);
  console.log(`  ~ unused in Figma:             ${unusedInFigma.length}\n`);

  if (missingFromBarrel.length > 0) {
    console.log(`── ✗ Missing from barrel (add to index.ts) ${'─'.repeat(17)}\n`);
    for (const name of missingFromBarrel) {
      console.log(`  ${name}`);
    }
    console.log('');
  }

  if (unusedInFigma.length > 0) {
    console.log(`── ~ In barrel but not found in scanned Figma files ${'─'.repeat(7)}\n`);
    for (const name of unusedInFigma) {
      console.log(`  ${name}`);
    }
    console.log('');
  }

  if (inBoth.length > 0) {
    console.log(`── ✓ Already in barrel ${'─'.repeat(36)}\n`);
    for (const name of inBoth) {
      console.log(`  ${name}`);
    }
    console.log('');
  }

  console.log(`${'═'.repeat(60)}`);
  if (missingFromBarrel.length > 0) {
    console.log(`\nNext step: add the ${missingFromBarrel.length} missing icon(s) to:`);
    console.log(`  packages/ui/src/icons/icons.tsx   (add components)`);
    console.log(`  packages/ui/src/icons/index.ts    (re-export from barrel)`);
    console.log(`\nSee: pnpm figma:svg-to-icons for bulk SVG import\n`);
  } else {
    console.log('\n✓ Barrel is up to date with the scanned Figma files.\n');
  }
})();
