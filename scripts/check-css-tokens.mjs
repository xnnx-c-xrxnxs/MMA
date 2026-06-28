#!/usr/bin/env node
// Verify packages/design-tokens/src/lib/tokens.css is in sync with packages/design-tokens/src/lib/tokens.ts
// by re-running the generator and comparing. Restores the original file if it differs.
//
// Used by ci-fast-check.yml. Kept as a standalone .mjs (not an inline `node -e` in
// package.json) because the previous inline form contained backticks that bash
// command-substituted before Node ever saw them.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const target = 'packages/design-tokens/src/lib/tokens.css';
const before = readFileSync(target, 'utf8');

execSync('node scripts/generate-css-tokens.mjs', { stdio: 'inherit' });

const after = readFileSync(target, 'utf8');
if (before !== after) {
  writeFileSync(target, before);
  console.error(
    '\n  tokens.css is out of sync with tokens.ts \u2014 run "pnpm tokens:gen" and commit the result.\n',
  );
  process.exit(1);
}
