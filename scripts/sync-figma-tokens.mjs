#!/usr/bin/env node
/**
 * Sync color primitive tokens from the project's Figma file into
 * packages/design-tokens/src/lib/tokens.ts, then regenerate tokens.css.
 *
 * ── How to use ───────────────────────────────────────────────────────────────
 *   1. In Figma, install the Variable Gen JSON plugin:
 *      figma.com/community/plugin/1572805660073830528
 *   2. Open your project's Figma file → run the plugin → variables.json downloads
 *   3. pnpm tokens:sync --from-file ~/Downloads/variables.json
 *
 * ── What gets patched ────────────────────────────────────────────────────────
 *   • Only the primitive hex values inside the FIGMA:SYNC sentinel block
 *     in tokens.ts are updated. Semantic aliases are never touched.
 *   • Prints a summary: N key(s) updated, M skipped (no match in tokens.ts).
 *
 * ── Optional overrides ───────────────────────────────────────────────────────
 *   FIGMA_PRIMITIVES_COLLECTION   Default: "Primitives"
 *   FIGMA_LIGHT_MODE              Default: "Light"
 *
 *   Map Figma group names → token key prefixes (example defaults built-in):
 *     FIGMA_COMPACT_PRIMITIVE_GROUPS='{"brand blue":"brand","error":"danger"}'
 *   Built-in defaults (override via FIGMA_COMPACT_PRIMITIVE_GROUPS as needed):
 *     "brand blue"          → brand
 *     "brand red"           → brandRed
 *     "gray (light mode)"   → gray
 *     "gray (dark mode)"    → grayDark
 *     "error"               → danger
 *     "warning"             → warning
 *     "success"             → success
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TOKENS_PATH = resolve(ROOT, 'packages/design-tokens/src/lib/tokens.ts');

// ─── Load .env.local (no deps — simple line parser) ──────────────────────────
try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
    }
  }
} catch {
  // .env.local absent — proceed with process.env
}

const PRIMITIVES_COLLECTION = process.env.FIGMA_PRIMITIVES_COLLECTION ?? 'Primitives';
const LIGHT_MODE = process.env.FIGMA_LIGHT_MODE ?? 'Light';

// ─── Mode C: compact format helpers ─────────────────────────────────────────
// Maps lowercase Figma variable-group paths → token key prefixes.
// Override by setting FIGMA_COMPACT_PRIMITIVE_GROUPS to a JSON string.
const COMPACT_PRIMITIVE_GROUPS = Object.assign(
  {
    'brand blue': 'brand',
    'brand red': 'brandRed',
    'gray (light mode)': 'gray',
    'gray (dark mode)': 'grayDark',
    error: 'danger',
    warning: 'warning',
    success: 'success',
  },
  process.env.FIGMA_COMPACT_PRIMITIVE_GROUPS
    ? JSON.parse(process.env.FIGMA_COMPACT_PRIMITIVE_GROUPS)
    : {},
);

/**
 * Returns true if the JSON looks like a compact nested export:
 *   { "Collection Name": { "Mode Name": { "Var/Path/Step": "#hex" } } }
 * Distinguishes from the Figma REST API format which always has a
 * `variableCollections` / `collections` / `variables` top-level key.
 */
function isCompactFormat(raw) {
  if (raw.variableCollections ?? raw.collections ?? raw.variables) return false;
  const firstVal = Object.values(raw)[0];
  if (!firstVal || typeof firstVal !== 'object') return false;
  const firstMode = Object.values(firstVal)[0];
  return (
    firstMode != null &&
    typeof firstMode === 'object' &&
    Object.values(firstMode).some((v) => typeof v === 'string' && v.startsWith('#'))
  );
}

/**
 * Extract primitive scale tokens from a compact-format export.
 * Only processes variable groups that are listed in COMPACT_PRIMITIVE_GROUPS.
 * Returns a flat map: { brand25: '#a1d0ff', gray500: '#667085', … }
 */
function extractPrimitivesFromCompact(raw) {
  // Find the primitives collection: prefer explicit PRIMITIVES_COLLECTION name
  // match first, then fall back to any single-mode collection.
  let primVars = null;
  let foundColName = null;

  // Pass 1 — exact name match (highest priority)
  for (const [name, modes] of Object.entries(raw)) {
    if (name.toLowerCase() === PRIMITIVES_COLLECTION.toLowerCase()) {
      const modeEntries = Object.entries(modes);
      primVars = modeEntries[0][1];
      foundColName = name;
      break;
    }
  }

  // Pass 2 — fallback: first single-mode collection
  if (!primVars) {
    for (const [name, modes] of Object.entries(raw)) {
      const modeEntries = Object.entries(modes);
      if (modeEntries.length === 1) {
        primVars = modeEntries[0][1];
        foundColName = name;
        break;
      }
    }
  }

  // Fallback: multi-mode collection — pick the Light mode from any collection
  // whose variables use the {group}-{step} dash-separated key pattern.
  if (!primVars) {
    for (const [name, modes] of Object.entries(raw)) {
      const modeEntries = Object.entries(modes);
      const [, lightVars] =
        modeEntries.find(([m]) => m.toLowerCase() === LIGHT_MODE.toLowerCase()) ??
        modeEntries[0] ??
        [];
      if (lightVars && Object.keys(lightVars).some((k) => /^[a-z][\w-]*-\d+$/i.test(k))) {
        primVars = lightVars;
        foundColName = `${name} / ${LIGHT_MODE}`;
        break;
      }
    }
  }

  if (!primVars) {
    console.warn(
      'tokens:sync — compact: could not identify a primitives collection ' +
        '(expected one with a single mode, or named matching FIGMA_PRIMITIVES_COLLECTION).\n' +
        '  Override with: FIGMA_PRIMITIVES_COLLECTION=<collection-name>',
    );
    return {};
  }

  console.log(`tokens:sync — compact: using "${foundColName}" as primitives collection`);

  const out = {};
  for (const [varPath, rawHex] of Object.entries(primVars)) {
    if (typeof rawHex !== 'string' || !rawHex.startsWith('#')) continue;

    // Normalise 8-char RGBA hex → 6-char RGB (strip alpha channel, e.g. #F9F5FFFF → #F9F5FF)
    const hex = rawHex.length === 9 ? rawHex.slice(0, 7) : rawHex;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) continue;

    // Dash-separated key: {group}-{step}  e.g. "brand-50", "danger-600"
    // Group name maps directly to prefix (identity fallback when not in COMPACT_PRIMITIVE_GROUPS)
    const dashMatch = /^(.+)-(\d+)$/.exec(varPath);
    if (dashMatch) {
      const groupRaw = dashMatch[1].toLowerCase();
      const step = dashMatch[2];
      const prefix = COMPACT_PRIMITIVE_GROUPS[groupRaw] ?? groupRaw;
      out[prefix + step] = hex;
      continue;
    }

    // Slash-path key: "Colors/Brand Blue/25" → parts = ["Colors","Brand Blue","25"]
    const parts = varPath.split('/');
    if (parts.length < 2) continue;

    const stepRaw = parts[parts.length - 1].trim();
    // Group = all parts except top-level "Colors" category and the terminal step
    const groupRaw = parts
      .slice(0, -1)
      .filter((p) => p.toLowerCase() !== 'colors')
      .join('/')
      .toLowerCase()
      .trim();

    // Match group against the mapping table (try full path, then first segment)
    const prefix =
      COMPACT_PRIMITIVE_GROUPS[groupRaw] ??
      COMPACT_PRIMITIVE_GROUPS[groupRaw.split('/')[0]] ??
      null;

    if (prefix == null) continue; // unmapped group — skip silently

    // Build key: strip leading zeros from numeric steps ("025" → "25")
    const step = stepRaw.replace(/^0+(?=\d)/, '');
    const key = /^\d/.test(step)
      ? prefix + step
      : prefix + step[0].toUpperCase() + step.slice(1);

    out[key] = hex;
  }

  return out;
}

/**
 * Apply a flat { key: '#hex' } patch to the FIGMA:SYNC block in tokens.ts.
 * Only updates hex literals next to an existing key — never adds new lines.
 * Returns [updatedCount, skippedCount].
 */
function applyPrimitivePatch(patch) {
  let source = readFileSync(TOKENS_PATH, 'utf8');

  const SYNC_START = '// ─── FIGMA:SYNC START';
  const SYNC_END = '// ─── FIGMA:SYNC END';
  const startIdx = source.indexOf(SYNC_START);
  const endIdx = source.indexOf(SYNC_END);
  if (startIdx === -1 || endIdx === -1) {
    console.error(
      '\n  Sync sentinel markers not found in tokens.ts.\n' +
        `  Expected comments starting with:\n` +
        `    "${SYNC_START}"\n` +
        `    "${SYNC_END}"\n`,
    );
    process.exit(1);
  }

  // Only patch inside the SYNC block — leave the rest of the file untouched
  const before = source.slice(0, startIdx);
  const syncBlock = source.slice(startIdx, endIdx);
  const after = source.slice(endIdx);

  let updated = 0;
  let skipped = 0;
  let patchedBlock = syncBlock;

  for (const [key, newHex] of Object.entries(patch)) {
    // Matches:  keyName: '#xxxxxx',   or  keyName: 'rgba(...)',
    const re = new RegExp(`(\\b${key}\\s*:\\s*)'[^']*'`, 'g');
    const before2 = patchedBlock;
    patchedBlock = patchedBlock.replace(re, `$1'${newHex}'`);
    if (patchedBlock !== before2) {
      updated++;
    } else {
      skipped++;
    }
  }

  writeFileSync(TOKENS_PATH, before + patchedBlock + after, 'utf8');
  return [updated, skipped];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
//   --from-file <path>  required
const fromFileFlag = process.argv.find((a) => a.startsWith('--from-file'));
const FROM_FILE = fromFileFlag
  ? fromFileFlag.includes('=')
    ? fromFileFlag.split('=').slice(1).join('=')
    : process.argv[process.argv.indexOf(fromFileFlag) + 1]
  : null;

if (!FROM_FILE) {
  console.error(
    '\n  Missing --from-file path.\n\n' +
      '  Usage:\n' +
      '    pnpm tokens:sync --from-file ~/Downloads/variables.json\n\n' +
      '  1. In Figma, install Variable Gen JSON:\n' +
      '     figma.com/community/plugin/1572805660073830528\n' +
      '  2. Open your project Figma file → run the plugin → variables.json downloads\n' +
      '  3. Run the command above\n',
  );
  process.exit(1);
}

const filePath = resolve(process.cwd(), FROM_FILE);
console.log(`tokens:sync — reading from ${filePath}…`);

let raw;
try {
  raw = JSON.parse(readFileSync(filePath, 'utf8'));
} catch (err) {
  console.error(`\n  Could not read --from-file path: ${filePath}\n  ${err.message}\n`);
  process.exit(1);
}

if (!isCompactFormat(raw)) {
  console.error(
    '\n  Unrecognised format.\n' +
      '  Expected the compact nested format from the Variable Gen JSON plugin:\n' +
      '    { "Collection": { "Mode": { "variable-name-step": "#hex" } } }\n\n' +
      '  Top-level keys found: ' +
      Object.keys(raw)
        .slice(0, 6)
        .map((k) => `"${k}"`)
        .join(', ') +
      (Object.keys(raw).length > 6 ? ' …' : '') +
      '\n',
  );
  process.exit(1);
}

console.log('tokens:sync — detected compact format, extracting primitives…');
const patch = extractPrimitivesFromCompact(raw);
const patchCount = Object.keys(patch).length;

if (patchCount === 0) {
  console.warn(
    'tokens:sync — no primitive keys extracted.\n' +
      '  Check that COMPACT_PRIMITIVE_GROUPS covers your variable group names.\n' +
      '  Detected collections: ' +
      Object.keys(raw)
        .map((n) => `"${n}"`)
        .join(', '),
  );
  process.exit(1);
}

console.log(
  `tokens:sync — patching ${patchCount} primitive key(s) in tokens.ts…\n` +
    `  (semantic aliases are preserved unchanged)`,
);
const [updated, skipped] = applyPrimitivePatch(patch);
console.log(
  `tokens:sync — updated ${updated} value(s)` +
    (skipped > 0 ? `, ${skipped} key(s) not found in tokens.ts (skipped)` : ''),
);

execSync('node scripts/generate-css-tokens.mjs', { cwd: ROOT, stdio: 'inherit' });
console.log('tokens:sync — done ✓');
