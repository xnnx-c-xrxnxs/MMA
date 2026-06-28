---
name: local-seed-data
description: Seed local LocalStack DynamoDB tables and Postgres databases with realistic dev data so the webapp / mobile app boot with non-empty lists. Use this when onboarding a new developer, adding a new domain that needs sample data for manual QA, or when LocalStack data is wiped and you need to rehydrate.
---

# Seeding Local Development Data

Canonical references:
- `scripts/setup-localstack.ts` — creates DynamoDB tables + SQS queues (no data)
- `scripts/prisma-migrate-all.ts` — runs Prisma migrations against local Postgres (no data)
- `infra/init-runner/scripts/` — production-grade deploy tasks (the seed pattern mirrors these but runs locally)

---

## When to Use This Skill

| Scenario | Use this skill |
|---|---|
| Fresh clone — webapp shows empty tables | ✅ |
| LocalStack volume wiped (`docker compose down -v`) | ✅ |
| Adding a new domain that needs realistic dev data | ✅ |
| Demoing a feature with non-trivial data shape | ✅ |
| Production data backfill | ❌ — use `init-runner-deploy-task` instead |
| E2E test fixture data | ❌ — E2E tests seed via API in `beforeEach` (see `write-api-e2e-tests`) |

---

## Convention

Local seed scripts live alongside the existing local-infra scripts and follow the same naming + entry-point convention:

```
scripts/
  setup-localstack.ts       ← existing — creates infra
  prisma-migrate-all.ts     ← existing — applies migrations
  seed-local.ts             ← NEW — orchestrator that calls per-domain seeders
  seed/
    user-seed.ts            ← per-domain seeder
    product-seed.ts
    order-seed.ts
```

Each per-domain seeder is **idempotent** (re-runnable without duplicates) and uses the **same API the application uses** — never write directly to DynamoDB / Postgres bypassing the domain entity validation.

### Per-domain seeder template

```ts
// scripts/seed/user-seed.ts
import 'dotenv/config';
import { createUserApiClient } from '@mma/client-common';

export async function seedUsers() {
  const api = createUserApiClient(process.env.API_USER_URL!);

  const users = [
    { email: 'admin@test.com',  name: 'Admin User',  userRole: 'ADMIN'  },
    { email: 'staff@test.com',  name: 'Staff User',  userRole: 'STAFF'  },
    { email: 'user1@test.com',  name: 'Regular One', userRole: 'USER'   },
    { email: 'user2@test.com',  name: 'Regular Two', userRole: 'USER'   },
  ];

  for (const u of users) {
    try {
      await api.createUser(u);
      console.log(`✓ seeded ${u.email}`);
    } catch (err: any) {
      if (err.statusCode === 409) {
        console.log(`· ${u.email} already exists, skipping`);
        continue;
      }
      throw err;
    }
  }
}

if (require.main === module) {
  seedUsers().catch((err) => { console.error(err); process.exit(1); });
}
```

### Orchestrator template

```ts
// scripts/seed-local.ts
import 'dotenv/config';
import { seedUsers }    from './seed/user-seed';
import { seedProducts } from './seed/product-seed';
import { seedOrders }   from './seed/order-seed';

async function main() {
  console.log('Seeding local data...');
  await seedUsers();
  await seedProducts();
  await seedOrders();          // depends on users + products existing
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
```

Add an npm script and a VS Code task:

```jsonc
// package.json
"scripts": {
  "seed:local": "tsx scripts/seed-local.ts"
}
```

```jsonc
// .vscode/tasks.json
{
  "label": "Local: Seed Data",
  "type": "shell",
  "command": "pnpm run seed:local",
  "problemMatcher": []
}
```

---

## Architectural Rules

1. **Always seed via the API, never via direct DB writes.** Direct writes bypass domain validation and produce data shapes the application cannot reproduce. The only exception is when seeding a brand-new domain whose API does not exist yet — in that case, use the repository directly via the domain package's exports, never raw SDK calls.

2. **Idempotent.** Seeders MUST be re-runnable without crashing or duplicating. Catch 409 Conflict (entity exists) and continue.

3. **Realistic but obviously fake.** Use `@test.com` / `@example.com` email domains, predictable IDs / names. Never seed data that could be mistaken for real customer data.

4. **Respect cross-domain ordering.** Seed users → products → orders. Use `await` between domains — never `Promise.all` across dependent domains.

5. **Local only.** Seed scripts MUST refuse to run when `STAGE !== 'local'`:
   ```ts
   if (process.env.STAGE !== 'local') {
     throw new Error('seed-local.ts must only run with STAGE=local');
   }
   ```
   Add this guard at the top of `seed-local.ts`. This prevents accidental seeding of dev / staging / prod.

6. **No fixture data in git for E2E.** E2E tests seed inside the test (see `write-api-e2e-tests`). The local seed script is for the webapp / mobile dev experience only.

7. **Document the seeded state.** When adding a new domain seeder, update `docs/getting-started.md` with what data the seeder creates so developers know what to expect in the UI.

---

## Wiring Into Onboarding

For new developers, add `pnpm run seed:local` as the final step of the local-bootstrap sequence in `docs/getting-started.md`:

```
1. Copy .env.local.example to .env.local
2. pnpm install
3. Run "Infra: Start All" task
4. Run "Services: Start All" task
5. pnpm run seed:local           ← NEW
6. Open http://localhost:4200
```

---

## Skills That Compose With This One

| Task | Also read |
|---|---|
| Adding the API client used by the seeder | `webapp-api-client-hooks` |
| Adding a new domain that needs seed data | `new-domain-package` (then create `scripts/seed/{domain}-seed.ts`) |
| Production data backfill (one-shot, in-VPC) | `init-runner-deploy-task` |
| E2E test data | `write-api-e2e-tests` |
| Diagnosing seeder failures | `debug-local-dev` |
