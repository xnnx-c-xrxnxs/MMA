#!/usr/bin/env node

/**
 * Seeds the GitHub label taxonomy used by:
 *   - docs/AI_ISSUE_CREATOR_PROMPT.md (label generation)
 *   - .claude/commands/triage-sprint.md (filtering + bundling)
 *   - .github/ISSUE_TEMPLATE/*.yml (issue templates)
 *
 * Project-specific domains come from `.github/issue-config.json`.
 * Edit that file when creating a new project from this template.
 *
 * Idempotent — uses `gh label create --force` so re-running updates colors/descriptions.
 *
 * Usage:
 *   node scripts/task-helpers/setup-github-labels.mjs              # uses current repo (gh auth context)
 *   node scripts/task-helpers/setup-github-labels.mjs owner/repo   # explicit target
 *
 * Requires: GitHub CLI (`gh`) authenticated with repo write access.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , repoArg] = process.argv;

// Verify gh is available + authenticated
const auth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf-8' });
if (auth.status !== 0) {
  console.error('❌ gh CLI is not authenticated. Run `gh auth login` first.');
  process.exit(1);
}

const repoFlag = repoArg ? ['--repo', repoArg] : [];

// ─── Load project-specific domain config ──────────────────────────────────────
const root = resolve(import.meta.dirname, '..', '..');
const configPath = resolve(root, '.github/issue-config.json');

if (!existsSync(configPath)) {
  console.error(`❌ Missing .github/issue-config.json at ${configPath}`);
  console.error('   Copy from the template and edit `domains[]` for this project.');
  process.exit(1);
}

/** @type {{ domains: Array<{name: string; description: string}>; crossCutting: Array<{name: string; description: string; color: string}> }} */
const config = JSON.parse(readFileSync(configPath, 'utf-8'));

if (!Array.isArray(config.domains) || config.domains.length === 0) {
  console.error('❌ issue-config.json must define at least one domain.');
  process.exit(1);
}

// ─── Build dynamic domain labels from config ──────────────────────────────────
const domainLabels = [
  ...config.domains.map((d) => ({
    name: `domain-${d.name}`,
    color: '1d76db', // blue for bounded contexts
    description: d.description || `${d.name} bounded context`,
  })),
  ...(config.crossCutting || []).map((d) => ({
    name: `domain-${d.name}`,
    color: d.color || '0366d6',
    description: d.description || `${d.name} surface`,
  })),
];

/** @type {Array<{ name: string; color: string; description: string }>} */
const labels = [
  // ─────────────────────────────────────────────────────────────
  // Issue type
  // ─────────────────────────────────────────────────────────────
  { name: 'user-story',        color: '0e8a16', description: 'Feature / user story (default for user-story.yml template)' },
  { name: 'type-bug',          color: 'd73a4a', description: 'Defect or regression' },
  { name: 'type-chore',        color: 'cfd3d7', description: 'Refactor, dependency upgrade, tooling, docs' },
  { name: 'needs-refinement',  color: 'fbca04', description: 'Auto-applied — needs grooming before being picked up' },
  { name: 'needs-triage',      color: 'fbca04', description: 'New bug/chore — needs triage' },

  // ─────────────────────────────────────────────────────────────
  // Priority (drives /triage-sprint scoring)
  // ─────────────────────────────────────────────────────────────
  { name: 'priority-critical', color: 'b60205', description: 'P0 — blocking release / production down' },
  { name: 'priority-high',     color: 'd93f0b', description: 'P1 — sprint-critical' },
  { name: 'priority-medium',   color: 'fbca04', description: 'P2 — planned for sprint, not blocking' },
  { name: 'priority-low',      color: '0e8a16', description: 'P3 — backlog / nice-to-have' },

  // ─────────────────────────────────────────────────────────────
  // Effort (drives /triage-sprint capacity bundling)
  // ─────────────────────────────────────────────────────────────
  { name: 'effort-xs', color: 'c2e0c6', description: '≤ 2 hours' },
  { name: 'effort-s',  color: 'bfd4f2', description: '≤ 8 hours' },
  { name: 'effort-m',  color: '5319e7', description: '≤ 16 hours' },
  { name: 'effort-l',  color: '8a2be2', description: '≤ 32 hours' },
  { name: 'effort-xl', color: '4b0082', description: '> 32 hours' },

  // ─────────────────────────────────────────────────────────────
  // Domain (bounded context) — populated from .github/issue-config.json below
  // ─────────────────────────────────────────────────────────────
  ...domainLabels,

  // ─────────────────────────────────────────────────────────────
  // Layer (read by /triage-sprint when bundling)
  // ─────────────────────────────────────────────────────────────
  { name: 'layer-backend', color: '006b75', description: 'Domain / application / infrastructure / presentation' },
  { name: 'layer-webapp',  color: '0052cc', description: 'Next.js page / component / hook' },
  { name: 'layer-mobile',  color: '0052cc', description: 'Expo screen / component / native code' },
  { name: 'layer-infra',   color: '5319e7', description: 'Terraform module / CD workflow' },

  // ─────────────────────────────────────────────────────────────
  // Story type (matches user-story.yml dropdown)
  // ─────────────────────────────────────────────────────────────
  { name: 'story-type-full-stack-backend-webapp',         color: 'c5def5', description: 'Backend + Webapp slice (parent issue)' },
  { name: 'story-type-full-stack-backend-webapp-mobile',  color: 'c5def5', description: 'Backend + Webapp + Mobile slice (parent issue)' },
  { name: 'story-type-backend-only',                      color: 'c5def5', description: 'Backend service / domain only' },
  { name: 'story-type-webapp-only',                       color: 'c5def5', description: 'Webapp only' },
  { name: 'story-type-mobile-only',                       color: 'c5def5', description: 'Mobile only' },
  { name: 'story-type-infrastructure-cd',                 color: 'c5def5', description: 'Terraform / CD pipeline change' },
  { name: 'story-type-cross-domain-integration-acl-or-saga', color: 'c5def5', description: 'Sync ACL or async choreography saga' },
  { name: 'story-type-event-driven-sqs-consumer',         color: 'c5def5', description: 'New SQS consumer service or handler' },

  // ─────────────────────────────────────────────────────────────
  // Parent / sub-issue relationship
  // ─────────────────────────────────────────────────────────────
  { name: 'parent-issue', color: 'a371f7', description: 'Parent of a Full Stack split (has -BE / -WEB / -MOB sub-issues)' },
  { name: 'sub-issue',    color: 'a371f7', description: 'Sub-issue of a Full Stack parent' },

  // ─────────────────────────────────────────────────────────────
  // Workflow hint (drives /triage-sprint prompt recommendation)
  // ─────────────────────────────────────────────────────────────
  { name: 'workflow-new-feature',             color: 'e99695', description: 'Run /new-feature' },
  { name: 'workflow-full-stack-feature',      color: 'e99695', description: 'Run /full-stack-feature' },
  { name: 'workflow-webapp-feature',          color: 'e99695', description: 'Run /webapp-feature' },
  { name: 'workflow-new-domain',              color: 'e99695', description: 'Run /new-domain' },
  { name: 'workflow-quick-crud-domain',       color: 'e99695', description: 'Run /quick-crud-domain' },
  { name: 'workflow-new-domain-dynamo',       color: 'e99695', description: 'Run /new-domain-dynamo' },
  { name: 'workflow-new-service',             color: 'e99695', description: 'Run /new-service' },
  { name: 'workflow-new-event-service',       color: 'e99695', description: 'Run /new-event-service' },
  { name: 'workflow-new-use-case',            color: 'e99695', description: 'Run /new-use-case' },
  { name: 'workflow-new-e2e-tests',           color: 'e99695', description: 'Run /new-e2e-tests' },
  { name: 'workflow-new-ui-primitive',        color: 'e99695', description: 'Run /new-ui-primitive' },
  { name: 'workflow-fe-accessibility-pass',   color: 'e99695', description: 'Run /fe-accessibility-pass' },
  { name: 'workflow-mobile-release',          color: 'e99695', description: 'Run /mobile-release' },
  { name: 'workflow-add-push-notifications',  color: 'e99695', description: 'Run /add-push-notifications' },
  { name: 'workflow-add-monitoring-feature',  color: 'e99695', description: 'Run /add-monitoring-feature' },
  { name: 'workflow-add-alerting',            color: 'e99695', description: 'Run /add-alerting' },
  { name: 'workflow-infra-new-module',        color: 'e99695', description: 'Direct work — use infra-new-module skill' },
  { name: 'workflow-cd-register-service',     color: 'e99695', description: 'Direct work — use cd-register-service skill' },
  { name: 'workflow-direct-work',             color: 'e99695', description: 'No orchestrator — use individual skills' },

  // ─────────────────────────────────────────────────────────────
  // Modifiers / risk flags (read by /triage-sprint)
  // ─────────────────────────────────────────────────────────────
  { name: 'blocked',            color: '000000', description: 'Cannot start — wait for blockers (skipped by /triage-sprint)' },
  { name: 'breaking-contract',  color: 'b60205', description: 'Changes a contracts package in a non-additive way (isolate from bundles)' },
  { name: 'requires-migration', color: 'd93f0b', description: 'Needs Prisma migration / DynamoDB GSI change' },
  { name: 'needs-preview',      color: 'fbca04', description: 'Reviewers should spin up a preview environment' },

  // ─────────────────────────────────────────────────────────────
  // Bug-only metadata (severity from bug.yml)
  // ─────────────────────────────────────────────────────────────
  { name: 'severity-s0', color: 'b60205', description: 'Production down' },
  { name: 'severity-s1', color: 'd93f0b', description: 'Major regression / broken flow' },
  { name: 'severity-s2', color: 'fbca04', description: 'Bug with workaround' },
  { name: 'severity-s3', color: '0e8a16', description: 'Cosmetic / minor' },
  { name: 'env-production', color: 'b60205', description: 'Reproduces in production' },
  { name: 'env-staging',    color: 'd93f0b', description: 'Reproduces in staging' },
  { name: 'env-dev',        color: 'fbca04', description: 'Reproduces in dev' },
  { name: 'env-preview',    color: 'fbca04', description: 'Reproduces in a preview environment' },
  { name: 'env-local',      color: '0e8a16', description: 'Reproduces locally only' },
];

// ─── Pre-flight: enforce GitHub's 100-char limit on label.description ─────────
// GitHub's REST API returns 422 Unprocessable Entity when a label description
// exceeds 100 characters. Catch this here so users get an actionable message
// pointing to the exact source (issue-config.json or the static labels array)
// instead of an opaque `gh` error mid-seed.
const GITHUB_LABEL_DESCRIPTION_MAX = 100;
const tooLong = labels
  .map((l) => ({ ...l, length: l.description.length }))
  .filter((l) => l.length > GITHUB_LABEL_DESCRIPTION_MAX);

if (tooLong.length > 0) {
  console.error(
    `\n❌ ${tooLong.length} label description(s) exceed GitHub's ${GITHUB_LABEL_DESCRIPTION_MAX}-character limit:\n`,
  );
  for (const l of tooLong) {
    const source = l.name.startsWith('domain-')
      ? `.github/issue-config.json → ${l.name.replace(/^domain-/, '')}`
      : 'scripts/task-helpers/setup-github-labels.mjs (static labels[])';
    console.error(`  • ${l.name} (${l.length} chars) — edit ${source}`);
    console.error(`      "${l.description}"`);
  }
  console.error(
    `\n   GitHub silently rejects label creation/updates when description > ${GITHUB_LABEL_DESCRIPTION_MAX} chars (HTTP 422).`,
  );
  console.error(`   Shorten the offending description(s) and re-run this task.\n`);
  process.exit(1);
}

console.log(`\n🏷️  Seeding ${labels.length} labels${repoArg ? ` on ${repoArg}` : ''}...`);
console.log(`   ${domainLabels.length} domain labels loaded from .github/issue-config.json (${config.projectName || 'unnamed project'})\n`);

let created = 0;
let updated = 0;
let failed = 0;

for (const label of labels) {
  const args = [
    'label', 'create', label.name,
    '--color', label.color,
    '--description', label.description,
    '--force',
    ...repoFlag,
  ];
  const res = spawnSync('gh', args, { encoding: 'utf-8' });
  if (res.status === 0) {
    const out = (res.stdout || '').trim();
    if (out.includes('updated') || out.includes('exists')) {
      updated++;
      process.stdout.write(`  ↻ ${label.name}\n`);
    } else {
      created++;
      process.stdout.write(`  ✚ ${label.name}\n`);
    }
  } else {
    failed++;
    process.stderr.write(`  ✗ ${label.name} — ${(res.stderr || '').trim()}\n`);
  }
}

console.log(`\n✅ Done. created/updated: ${created + updated}, failed: ${failed}\n`);

if (failed > 0) process.exit(1);
