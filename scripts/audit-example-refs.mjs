#!/usr/bin/env node
/**
 * audit-example-refs.mjs
 *
 * Originally a deliverable of the examples-isolation migration; retained as the
 * ongoing guard behind the `skills-no-example-imports` lint check.
 *
 * Scans the knowledge layer + universal packages for references to example domains
 * (users, products, orders, categories, payment) and produces a deterministic
 * inventory used to drive Phase 2's audit work and the future
 * `skills-no-example-imports` lint check.
 *
 * Output: tmp/example-refs-report.json
 *
 * Categories:
 *   - markdown-link  → [text](apps/users/...) or [text](packages/user-domain/...)
 *   - import         → import ... from '@old-st/user-domain' or similar
 *   - code-fence     → match inside a fenced code block (``` ... ```)
 *   - inline-code    → match inside `backticks`
 *   - plain-text     → bare prose mention
 *
 * Run:
 *   node scripts/audit-example-refs.mjs
 *
 * Re-run any time. Output is deterministic (sorted by file then line).
 */

import { readFile, mkdir, writeFile, glob } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tiny wrapper around node:fs/promises `glob` so the rest of the script keeps
 * its previous async-array API. Supports a single `ignore` array of patterns.
 */
async function globFiles(pattern, { cwd, ignore = [] } = {}) {
  const out = [];
  for await (const entry of glob(pattern, { cwd, exclude: ignore })) {
    out.push(entry.split(sep).join('/'));
  }
  return out;
}

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(__filename, '..', '..');

// ---------------------------------------------------------------------------
// Glob set — keep in sync with `skills-no-example-imports` lint check (D10).
// ---------------------------------------------------------------------------
const SCAN_GLOBS = [
  '.claude/skills/**/*.md',
  '.claude/commands/**/*.md',
  '.claude/agents/**/*.md',
  'CLAUDE.md',
  'apps/**/CLAUDE.md',
  'packages/**/CLAUDE.md',
  'infra/CLAUDE.md',
  'docs/code-review-guidelines.md',
  'docs/agents-catalog.md',
  'docs/AGENT_ARCHITECTURE.md',
  'docs/engineering-handbook.md',
  'docs/PROJECT_BOOTSTRAP.md',
  'docs/PROJECT_CONTEXT.md',
  'docs/QUICK_START_BA.md',
  'docs/AI_ISSUE_CREATOR_PROMPT.md',
  'docs/NOTEBOOKLM_EXTRACTION_PROMPT.md',
  'docs/ISSUE_CREATOR_RUNBOOK.md',
  'docs/MIGRATION_WORKFLOW_GUIDE.md',
  '.github/CODEOWNERS',
  'docs/**/*.md',
  'README.md',
  'AGENTS.md',
  'DEPLOYMENT.md',
  'infra/README.md',
  'infra/bootstrap/README.md',
  'packages/common/README.md',
  '.specs/**/*.md',
  // Universal packages — must not import example domains
  'packages/ui/src/**/*.{ts,tsx}',
  'packages/mobile-ui/src/**/*.{ts,tsx}',
  'packages/client-common/src/**/*.{ts,tsx}',
  // Universal apps
  'apps/auth/**/*.ts',
  'apps/files/**/*.ts',
  'apps/monitoring/**/*.{ts,tsx}',
  // VS Code workspace files
  'old-st-template.code-workspace',
  '.vscode/*.json',
  '.vscode/init-env.sh',
  // Lint config (will need updating as part of Phase 2.4)
  'coding-standards.config.ts',
  'scripts/lint-standards.ts',
  // Issue templates
  '.github/ISSUE_TEMPLATE/*',
];

const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  'docs/html/**',
  'examples/**',
  'tmp/**',
];

// ---------------------------------------------------------------------------
// Forbidden patterns. Order matters — most specific first.
// ---------------------------------------------------------------------------
/** @type {{name: string, regex: RegExp}[]} */
const PATTERNS = [
  { name: 'examples-path',          regex: /examples\/[A-Za-z0-9_./-]+/g },
  { name: 'app-domain-path',        regex: /apps\/(users|products|orders)\/[A-Za-z0-9_./-]+/g },
  { name: 'app-domain-bare',        regex: /\bapps\/(users|products|orders)\b/g },
  { name: 'package-domain-path',    regex: /packages\/(user|product|order)-domain\/[A-Za-z0-9_./-]+/g },
  { name: 'package-domain-bare',    regex: /\bpackages\/(user|product|order)-domain\b/g },
  { name: 'contracts-domain-path',  regex: /packages\/contracts\/(user|product|order|payment)\/[A-Za-z0-9_./-]+/g },
  { name: 'contracts-domain-bare',  regex: /\bpackages\/contracts\/(user|product|order|payment)\b/g },
  { name: 'import-domain-package',  regex: /@old-st\/(user|product|order)-domain(?:\/[A-Za-z0-9_./-]+)?/g },
  { name: 'import-contracts-domain',regex: /@old-st\/contracts\/(user|product|order|payment)(?:\/[A-Za-z0-9_./-]+)?/g },
];

// Matches the allowed exception (docs/decisions/001-examples-frozen-isolated-workspace.md, extended):
// Any line that contains an explicit markdown link to examples/ is permitted.
// Examples (all allowed):
//   > **Reference implementation:** [examples/...](examples/...)
//   > **Reference implementation:** see [examples/...](examples/...) and [examples/...](examples/...)
//   | Reference implementation | [examples/foo](examples/foo) | [examples/bar](examples/bar) |
//   ... (see [examples/path/to/file](examples/path/to/file) for the full template)
// Rationale: per Decision D11, references to examples/ from the knowledge layer are
// allowed *only* as explicit cross-refs, not as raw bare paths. A markdown link
// `[examples/x](examples/x)` is unambiguously an intentional cross-ref, regardless
// of the line's exact prose template.
const EXCEPTION_REGEX = /\[examples\/[^\]]+\]\(examples\/[^)]+\)/;

// ---------------------------------------------------------------------------
// Categorise a single match by its surrounding context within the line.
// ---------------------------------------------------------------------------
function categorize(line, matchIndex, matchText) {
  // markdown link: [text](match...)
  // Look for `](` immediately before matchIndex (allow up to ~10 chars of url scheme prefix like ./)
  const before = line.slice(Math.max(0, matchIndex - 5), matchIndex);
  if (/]\(\.?\/?$/.test(before) || /]\($/.test(before)) {
    return 'markdown-link';
  }

  // import / from: contains `from '...'` or `import '...'` or `require('...)`
  if (/\b(import|from|require)\b/.test(line)) {
    if (matchText.startsWith('@old-st/') || matchText.startsWith('packages/') || matchText.startsWith('apps/') || matchText.startsWith('examples/')) {
      // Check the match is inside quotes
      const quoteBefore = line.lastIndexOf("'", matchIndex);
      const dquoteBefore = line.lastIndexOf('"', matchIndex);
      const lastQuote = Math.max(quoteBefore, dquoteBefore);
      if (lastQuote >= 0) {
        const quoteChar = line[lastQuote];
        const closingQuote = line.indexOf(quoteChar, matchIndex + matchText.length);
        if (closingQuote > matchIndex) {
          return 'import';
        }
      }
    }
  }

  // inline-code: `match`
  const tickBefore = line.lastIndexOf('`', matchIndex);
  const tickAfter = line.indexOf('`', matchIndex + matchText.length);
  if (tickBefore >= 0 && tickAfter > matchIndex) {
    // Make sure no closing tick exists between tickBefore and matchIndex
    const between = line.slice(tickBefore + 1, matchIndex);
    if (!between.includes('`')) {
      return 'inline-code';
    }
  }

  return 'plain-text';
}

// ---------------------------------------------------------------------------
// Detect whether a line is inside a fenced code block by tracking state across
// the full file content.
// ---------------------------------------------------------------------------
function buildFenceMap(content) {
  const lines = content.split('\n');
  const fenceMap = new Array(lines.length).fill(false);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      // The fence marker line itself is considered part of the fence boundary, not content
      fenceMap[i] = false;
      continue;
    }
    fenceMap[i] = inFence;
  }
  return { lines, fenceMap };
}

// ---------------------------------------------------------------------------
// Propose an action based on category + file path.
// ---------------------------------------------------------------------------
function proposeAction(category, filePath, matchText) {
  if (category === 'import') {
    return 'replace-with-placeholder-or-move-to-examples';
  }
  if (category === 'markdown-link') {
    return 'replace-with-inline-template-or-add-reference-footer';
  }
  if (category === 'code-fence') {
    return 'rewrite-with-{domain}-{Entity}-placeholders';
  }
  if (category === 'inline-code') {
    return 'rewrite-as-{domain}-or-{Entity}';
  }
  return 'rewrite-as-generic-prose';
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------
async function scanFile(absPath) {
  const relPath = relative(repoRoot, absPath).split(sep).join('/');
  let content;
  try {
    content = await readFile(absPath, 'utf-8');
  } catch (err) {
    return { file: relPath, error: err.message, matches: [] };
  }

  const { lines, fenceMap } = buildFenceMap(content);
  /** @type {Array<{file: string, line: number, column: number, match: string, pattern: string, category: string, allowedException: boolean, proposedAction: string, lineText: string}>} */
  const matches = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    const lineNumber = i + 1;
    const lineIsException = EXCEPTION_REGEX.test(lineText);
    const inFence = fenceMap[i];

    for (const { name: patternName, regex } of PATTERNS) {
      // Reset regex state for global flag
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(lineText)) !== null) {
        const matchText = m[0];
        const matchIndex = m.index;
        const baseCategory = categorize(lineText, matchIndex, matchText);
        const category = inFence ? 'code-fence' : baseCategory;
        matches.push({
          file: relPath,
          line: lineNumber,
          column: matchIndex + 1,
          match: matchText,
          pattern: patternName,
          category,
          allowedException: lineIsException,
          proposedAction: proposeAction(category, relPath, matchText),
          lineText: lineText.length > 200 ? lineText.slice(0, 200) + '…' : lineText,
        });
      }
    }
  }

  return { file: relPath, matches };
}

async function main() {
  // Resolve all files matching SCAN_GLOBS
  const fileSet = new Set();
  for (const pattern of SCAN_GLOBS) {
    const found = await globFiles(pattern, {
      cwd: repoRoot,
      ignore: IGNORE_GLOBS,
    });
    for (const f of found) fileSet.add(f);
  }
  const files = [...fileSet].sort();

  const allMatches = [];
  const fileSummaries = [];
  const categoryCounts = {};
  const patternCounts = {};
  const filesWithMatches = [];

  for (const relFile of files) {
    const abs = resolve(repoRoot, relFile);
    const result = await scanFile(abs);
    if (result.matches.length > 0) {
      filesWithMatches.push(relFile);
      fileSummaries.push({
        file: relFile,
        matchCount: result.matches.length,
        nonExceptionCount: result.matches.filter((m) => !m.allowedException).length,
      });
    }
    for (const m of result.matches) {
      allMatches.push(m);
      categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
      patternCounts[m.pattern] = (patternCounts[m.pattern] || 0) + 1;
    }
  }

  // Sort matches deterministically
  allMatches.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });

  fileSummaries.sort((a, b) => b.matchCount - a.matchCount);

  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    scanGlobs: SCAN_GLOBS,
    ignoreGlobs: IGNORE_GLOBS,
    summary: {
      totalFilesScanned: files.length,
      filesWithMatches: filesWithMatches.length,
      totalMatches: allMatches.length,
      nonExceptionMatches: allMatches.filter((m) => !m.allowedException).length,
      byCategory: categoryCounts,
      byPattern: patternCounts,
      top20FilesByMatchCount: fileSummaries.slice(0, 20),
    },
    matches: allMatches,
  };

  const outDir = resolve(repoRoot, 'tmp');
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, 'example-refs-report.json');
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf-8');

  // Console summary (so the script is useful when invoked manually)
  console.log('───────────────────────────────────────────────────────────');
  console.log('  Example references audit — Phase 0.3');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  Files scanned:           ${report.summary.totalFilesScanned}`);
  console.log(`  Files with matches:      ${report.summary.filesWithMatches}`);
  console.log(`  Total matches:           ${report.summary.totalMatches}`);
  console.log(`  Non-exception matches:   ${report.summary.nonExceptionMatches}`);
  console.log('  By category:');
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat.padEnd(18)} ${count}`);
  }
  console.log('  By pattern:');
  for (const [pat, count] of Object.entries(patternCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pat.padEnd(28)} ${count}`);
  }
  console.log('  Top files:');
  for (const s of report.summary.top20FilesByMatchCount.slice(0, 10)) {
    console.log(`    ${String(s.matchCount).padStart(4)}  ${s.file}`);
  }
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  Full report: ${relative(repoRoot, outPath).split(sep).join('/')}`);
  console.log('───────────────────────────────────────────────────────────');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
