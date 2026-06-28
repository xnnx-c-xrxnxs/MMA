/**
 * Prisma Migrate All Script
 *
 * Loads .env.local and runs `prisma migrate deploy` for every Prisma-based domain.
 *
 * Usage (recommended — uses package.json scripts):
 *   pnpm run prisma:migrate:all           # Deploy pending migrations for all Prisma domains
 *
 * Direct invocation:
 *   npx ts-node --project scripts/tsconfig.json scripts/prisma-migrate-all.ts
 *
 * Prerequisites:
 *   - PostgreSQL running: docker compose up -d
 *   - .env.local at workspace root (see §7.1 in CLAUDE.md)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW PRISMA DOMAIN:
 *
 *   1. Add an entry to PRISMA_DOMAINS below with the schema path.
 *   2. Add an entry to PRISMA_DOMAINS in scripts/prisma-generate-all.ts with the same schema path.
 *   3. Add the corresponding npm scripts to root package.json:
 *        "prisma:{domain}:generate":       "prisma generate --schema=..."
 *        "prisma:{domain}:migrate:dev":    "prisma migrate dev --schema=..."
 *        "prisma:{domain}:migrate:deploy": "prisma migrate deploy --schema=..."
 *        "prisma:{domain}:studio":         "prisma studio --schema=..."
 *   3. Add {DOMAIN}_DATABASE_URL to .env.local and .env.local.example.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

// ─── Load .env.local (same pattern as setup-localstack.ts) ───────────────────
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// ─── Prisma domain registry ─────────────────────────────────────────────────
// Add new Prisma-based domains here.

interface PrismaDomain {
  /** Display name for logging */
  name: string;
  /** Path to schema.prisma relative to workspace root */
  schemaPath: string;
  /** Env var name for the database URL (verified before migrating) */
  envVar: string;
}

const PRISMA_DOMAINS: PrismaDomain[] = [
  // ── Add new Prisma domains here ──
  // {
  //   name: '{domain}-domain',
  //   schemaPath: 'packages/{domain}-domain/src/infrastructure/prisma/schema.prisma',
  //   envVar: '{DOMAIN}_DATABASE_URL',
  // },
];

// ─── Main ────────────────────────────────────────────────────────────────────

let hasErrors = false;

for (const domain of PRISMA_DOMAINS) {
  const schemaFullPath = path.resolve(process.cwd(), domain.schemaPath);

  if (!fs.existsSync(schemaFullPath)) {
    console.error(`❌ [${domain.name}] Schema not found: ${domain.schemaPath}`);
    hasErrors = true;
    continue;
  }

  const dbUrl = process.env[domain.envVar];
  if (!dbUrl) {
    console.error(
      `❌ [${domain.name}] Missing env var ${domain.envVar}. ` +
        `Add it to .env.local (see §7.1 in CLAUDE.md).`,
    );
    hasErrors = true;
    continue;
  }

  console.log(`\n🔄 [${domain.name}] Running prisma migrate deploy...`);
  console.log(`   Schema: ${domain.schemaPath}`);

  try {
    execSync(`npx prisma migrate deploy --schema=${domain.schemaPath}`, {
      stdio: 'inherit',
      env: process.env,
    });
    console.log(`✅ [${domain.name}] Migrations applied successfully.`);
  } catch {
    console.error(`❌ [${domain.name}] Migration failed.`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\n⚠️  Some migrations failed. Check errors above.');
  process.exit(1);
} else {
  console.log('\n✅ All Prisma migrations applied successfully.');
}
