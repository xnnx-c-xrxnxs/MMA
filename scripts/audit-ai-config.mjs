#!/usr/bin/env node
/**
 * audit-ai-config.mjs — Guard that the Copilot → Claude Code migration stays 100%.
 *
 * The repo was originally configured for GitHub Copilot (.github/copilot-instructions.md,
 * .github/prompts|skills|agents|instructions). It is now consolidated onto Claude Code
 * (CLAUDE.md + nested CLAUDE.md, .claude/commands|skills|agents, .specs/ spec files).
 *
 * This scanner FAILS (exit 1) if any TRACKED git file contains a "pre-migration
 * signal" — a leftover reference to the old Copilot layout, an old file convention,
 * or a parallel AI-tool agent config dir (.cursor/, .opencode/, .windsurf/). It is
 * the deterministic answer to "did we migrate everything?" and the regression guard.
 *
 * Run locally:  node scripts/audit-ai-config.mjs        (human summary, exit 0/1)
 *               node scripts/audit-ai-config.mjs --quiet (writes JSON report only)
 * Wired into:   scripts/lint-standards.ts → check `no-legacy-ai-config-references`,
 *               which runs via `pnpm lint:standards` in husky pre-commit + pre-push
 *               and in .github/workflows/ci-fast-check.yml.
 *
 * Output: tmp/ai-config-report.json (always written, for the lint check to read)
 * Exit codes: 0 clean · 1 violations found · 2 git not available
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const QUIET = process.argv.includes('--quiet');

// ─── Tracked files via git ──────────────────────────────────────────────────
const ls = spawnSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf-8' });
if (ls.status !== 0) {
  console.error('FATAL: `git ls-files` failed. Is this a git repository?');
  console.error(ls.stderr);
  process.exit(2);
}
const tracked = ls.stdout.split('\n').filter(Boolean);

// ─── Allowlist (intentional keepers — never flagged) ────────────────────────
// Each entry is either an exact path or a path-prefix (ending in '/').
const ALLOWLIST = [
  'examples/', // frozen pre-migration snapshot (CI-excluded)
  '.mcp.json', // api.githubcopilot.com is the GitHub MCP endpoint
  'docs/decisions/007-runsubagent-tool-mapping.md', // superseded ADR (historical record)
  'docs/decisions/008-migrate-ai-config-to-claude-code.md', // the migration record itself
  'scripts/audit-ai-config.mjs', // self — contains the patterns as literals
  'scripts/audit-example-refs.mjs', // sibling scanner — contains path literals
  'scripts/lint-standards.ts', // standards runner — references the patterns
  'coding-standards.config.ts', // declares the check + its description
  'docs/coding-standards.md', // documents this check
];

function isAllowlisted(relPath) {
  return ALLOWLIST.some((a) => (a.endsWith('/') ? relPath.startsWith(a) : relPath === a));
}

// ─── Path-level deny rules (the file's location/name is itself the violation) ─
const DENIED_PATHS = [
  { pattern: /^\.cursor\//, reason: 'Parallel AI-tool config (Cursor) — use .claude/ only; add to .gitignore' },
  { pattern: /^\.opencode\//, reason: 'Parallel AI-tool config (OpenCode) — use .claude/ only; add to .gitignore' },
  { pattern: /^\.windsurf\//, reason: 'Parallel AI-tool config (Windsurf) — use .claude/ only; add to .gitignore' },
  { pattern: /^\.aider/, reason: 'Parallel AI-tool config (Aider) — use .claude/ only' },
  { pattern: /^\.copilot\//, reason: 'Legacy spec dir — renamed to .specs/ for clarity (the .copilot name implied GitHub Copilot)' },
  { pattern: /^\.github\/(prompts|skills|agents|instructions)\//, reason: 'Copilot-era AI config dir — migrated to .claude/' },
  { pattern: /^\.github\/chatmodes\//, reason: 'Copilot chatmode dir — not used by Claude Code' },
  { pattern: /^\.github\/copilot-.*\.md$/, reason: 'Copilot instruction file — migrated to CLAUDE.md' },
  { pattern: /\.prompt\.md$/, reason: 'Copilot prompt convention — migrated to .claude/commands/*.md' },
  { pattern: /\.agent\.md$/, reason: 'Copilot agent convention — migrated to .claude/agents/*.md' },
  { pattern: /\.instructions\.md$/, reason: 'Copilot instructions convention — migrated to nested CLAUDE.md' },
  { pattern: /\.chatmode\.md$/, reason: 'Copilot chatmode convention — not used by Claude Code' },
];

// ─── Content-level deny rules ───────────────────────────────────────────────
const CONTENT_RULES = [
  {
    name: 'Copilot tool-name reference',
    // "Copilot" / "GitHub Copilot" but NOT ".copilot" (caught by its own rule
    // below) or "githubcopilot" (the MCP host). Lookbehind excludes '.', word char, '-'.
    pattern: /(?<![.\w-])copilot/i,
  },
  {
    name: 'Legacy .copilot spec-dir reference (renamed to .specs/)',
    pattern: /\.copilot\b/,
  },
  {
    name: 'Old Copilot AI-config path',
    pattern: /\.github\/(prompts|skills|agents|instructions)\//,
  },
  {
    name: 'Old Copilot instruction file',
    pattern: /\.github\/copilot-[a-z-]*\.md/,
  },
  {
    name: 'Copilot applyTo: frontmatter',
    pattern: /^applyTo:/m,
  },
  {
    name: 'runSubagent() textual directive (Copilot-era)',
    pattern: /runSubagent\s*\(/,
  },
  {
    name: 'Reference to deleted migration doc',
    pattern: /\bMIGRATION_(DECISIONS|PLAN)\.md\b/,
  },
];

// Binary / lockfile extensions we never content-scan.
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.pdf',
  '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.otf',
  '.mp3', '.mp4', '.mov',
]);
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb']);

function fileExt(p) {
  const i = p.lastIndexOf('.');
  return i >= 0 ? p.slice(i).toLowerCase() : '';
}

// ─── Scan ───────────────────────────────────────────────────────────────────
const matches = [];

for (const file of tracked) {
  if (isAllowlisted(file)) continue;

  // Path-level rules
  for (const rule of DENIED_PATHS) {
    if (rule.pattern.test(file)) {
      matches.push({ file, line: 0, rule: rule.reason, kind: 'path', snippet: file });
    }
  }

  // Content-level rules
  if (SKIP_FILES.has(file) || SKIP_EXT.has(fileExt(file))) continue;
  const full = join(ROOT, file);
  if (!existsSync(full)) continue;
  let content;
  try {
    content = readFileSync(full, 'utf-8');
  } catch {
    continue;
  }
  if (content.length > 0 && content.slice(0, 8192).includes('\0')) continue; // binary

  const lines = content.split('\n');
  for (const rule of CONTENT_RULES) {
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        matches.push({
          file,
          line: i + 1,
          rule: rule.name,
          kind: 'content',
          snippet: lines[i].trim().slice(0, 140),
        });
      }
    }
  }
}

matches.sort((a, b) => (a.file !== b.file ? a.file.localeCompare(b.file) : a.line - b.line));

// ─── Write report (always — the lint check reads this) ──────────────────────
const report = {
  generatedAt: new Date().toISOString(),
  totalFilesScanned: tracked.length,
  totalMatches: matches.length,
  matches,
};
const outDir = join(ROOT, 'tmp');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'ai-config-report.json'), JSON.stringify(report, null, 2), 'utf-8');

// ─── Human summary (skipped in --quiet) ─────────────────────────────────────
if (!QUIET) {
  console.log(`audit-ai-config — scanned ${tracked.length} tracked files`);
  if (matches.length === 0) {
    console.log('✓ No legacy AI-config references found. Migration is 100% clean.');
  } else {
    console.error(`\n✗ ${matches.length} legacy AI-config reference(s) found:\n`);
    for (const m of matches) {
      console.error(`  ${m.file}${m.line ? `:${m.line}` : ''}`);
      console.error(`    rule: ${m.rule}`);
      if (m.snippet && m.kind === 'content') console.error(`    line: ${m.snippet}`);
      console.error('');
    }
    console.error('Fix: migrate the reference to the Claude Code layout (.claude/, CLAUDE.md).');
    console.error('     If a hit is intentional, add it to ALLOWLIST in scripts/audit-ai-config.mjs.');
  }
}

process.exit(matches.length === 0 ? 0 : 1);
