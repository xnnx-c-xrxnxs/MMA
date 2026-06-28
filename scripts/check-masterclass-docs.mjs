#!/usr/bin/env node
// Verify the generated masterclass tutorial HTML is in sync with its .mjs sources
// under scripts/masterclass/, by re-running each generator and comparing. Restores
// the original file if it differs (so the check is non-destructive).
//
// Mirrors scripts/check-css-tokens.mjs. Runnable via `pnpm docs:masterclass:check`.
// Prevents a regenerate from silently reintroducing stale wording (e.g. an old
// tool name) that was fixed in the .mjs source but not the committed HTML.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const builds = [
  { generator: 'scripts/masterclass/build.mjs', output: 'docs/tutorial/domain-entities-masterclass.html' },
  { generator: 'scripts/masterclass/build-fe-webapp.mjs', output: 'docs/tutorial/fe-webapp-masterclass.html' },
];

let drift = false;

for (const { generator, output } of builds) {
  const before = readFileSync(output, 'utf8');
  execSync(`node ${generator}`, { stdio: 'inherit' });
  const after = readFileSync(output, 'utf8');
  if (before !== after) {
    writeFileSync(output, before); // restore — keep the check non-destructive
    console.error(
      `\n  ${output} is out of sync with its source under scripts/masterclass/ — ` +
        `run "pnpm docs:masterclass:gen" and commit the result.\n`,
    );
    drift = true;
  }
}

if (drift) process.exit(1);
console.log('✓ masterclass docs are in sync with their sources');
