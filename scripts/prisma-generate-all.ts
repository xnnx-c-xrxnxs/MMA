/**
 * Prisma Generate All Script
 *
 * Runs `prisma generate` for every Prisma-based domain registered in PRISMA_DOMAINS.
 * When the array is empty (base template with no Prisma domains) the script exits
 * successfully as a no-op — safe to call in CI on any project.
 *
 * Usage (recommended — uses package.json scripts):
 *   pnpm run prisma:generate:all           # Generate clients for all Prisma domains
 *
 * Direct invocation:
 *   npx ts-node --project scripts/tsconfig.json scripts/prisma-generate-all.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW PRISMA DOMAIN:
 *
 *   1. Add an entry to PRISMA_DOMAINS below with the schema path.
 *   2. Add the corresponding npm scripts to root package.json:
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

// ─── Prisma domain registry ─────────────────────────────────────────────────
// Add new Prisma-based domains here.

interface PrismaDomain {
  /** Display name for logging */
  name: string;
  /** Path to schema.prisma relative to workspace root */
  schemaPath: string;
}

const PRISMA_DOMAINS: PrismaDomain[] = [
  // ── Add new Prisma domains here ──
  // {
  //   name: '{domain}-domain',
  //   schemaPath: 'packages/{domain}-domain/src/infrastructure/prisma/schema.prisma',
  // },
];

// ─── Main ────────────────────────────────────────────────────────────────────

if (PRISMA_DOMAINS.length === 0) {
  console.log('ℹ️  No Prisma domains registered. Skipping generate.');
  console.log('   Add entries to PRISMA_DOMAINS in scripts/prisma-generate-all.ts');
  console.log('   when you introduce a Prisma domain to your project.');
  process.exit(0);
}

let hasErrors = false;

for (const domain of PRISMA_DOMAINS) {
  const schemaFullPath = path.resolve(process.cwd(), domain.schemaPath);

  if (!fs.existsSync(schemaFullPath)) {
    console.error(`❌ [${domain.name}] Schema not found: ${domain.schemaPath}`);
    hasErrors = true;
    continue;
  }

  console.log(`\n🔄 [${domain.name}] Running prisma generate...`);
  console.log(`   Schema: ${domain.schemaPath}`);

  try {
    execSync(`npx prisma generate --schema=${domain.schemaPath}`, {
      stdio: 'inherit',
      env: process.env,
    });
    console.log(`✅ [${domain.name}] Client generated successfully.`);
  } catch {
    console.error(`❌ [${domain.name}] Generate failed.`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\n⚠️  Some generates failed. Check errors above.');
  process.exit(1);
} else {
  console.log('\n✅ All Prisma clients generated successfully.');
}
