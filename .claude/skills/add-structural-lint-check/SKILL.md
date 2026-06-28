---
name: add-structural-lint-check
description: Add a new structural coding standards check to coding-standards.config.ts and scripts/lint-standards.ts. Use this when a new architectural rule needs to be enforced automatically across the codebase (e.g. a new file pattern, import restriction, or naming convention).
---

# Add a Structural Lint Check

Canonical reference: `scripts/lint-standards.ts` + `coding-standards.config.ts`

---

## When to Use This Skill

Use this skill when you need to enforce a new architectural rule that ESLint cannot express — for example:
- A file must (or must not) exist under a specific path pattern
- A code pattern is forbidden in a specific layer (e.g. domain must not import from NestJS)
- A naming convention must be followed across all services
- Two files must stay in sync (e.g. service registry vs module code)

**Do not** create a structural check for things ESLint can already enforce (import rules, nullability, etc.).

---

## File Locations

| File | Purpose |
|---|---|
| `coding-standards.config.ts` | Toggle interface + default config object. The single source of truth for which checks exist. |
| `scripts/lint-standards.ts` | All check implementations. Reads the config and runs only enabled checks. |

---

## Step 1 — Add to the Config Interface

Open `coding-standards.config.ts` and add a new boolean property to the `CodingStandardsConfig` interface:

```typescript
export interface CodingStandardsConfig {
  checks: {
    // ... existing checks
    /** Your description here — reference the relevant Golden Rule number if applicable */
    'your-check-name': boolean;
  };
  exclude?: string[];
}
```

Then add the default value in the `config` object:

```typescript
const config: CodingStandardsConfig = {
  checks: {
    // ... existing
    'your-check-name': true,
  },
  exclude: ['**/node_modules/**', '**/dist/**', '**/generated/**'],
};
```

**Naming conventions:**
- Use `kebab-case`
- Prefix with the layer it applies to: `no-` (forbids something), `{entity}-must-` (requires something)
- Good examples: `no-toObject-in-entities`, `domain-exception-filter-exists`, `service-registry-sync`

---

## Step 2 — Implement the Check Function

Open `scripts/lint-standards.ts`. Add a new function before the `// Run` section at the bottom.

### Template — File Must Exist check

```typescript
// ---------------------------------------------------------------------------
// Check: {your-check-name} ({optional rule reference e.g. A14})
// ---------------------------------------------------------------------------

function checkYourCheckName(): void {
  if (!config.checks['your-check-name']) return;

  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return;

  const domainDirs = fs.readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const domain of domainDirs) {
    const domainPath = path.join(appsDir, domain.name);
    const serviceDirs = fs.readdirSync(domainPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const service of serviceDirs) {
      if (!service.includes('-api-service')) continue; // scope to API services only

      const targetFile = path.join(domainPath, service, 'src', 'path', 'to', 'required-file.ts');
      if (!fs.existsSync(targetFile)) {
        errors.push(
          `[your-check-name] ${domain.name}/${service} is missing path/to/required-file.ts. ` +
          `Explanation of why this is required.`
        );
      }
    }
  }
}
```

### Template — Forbidden Pattern in Files check

```typescript
function checkYourForbiddenPattern(): void {
  if (!config.checks['your-check-name']) return;

  const tsFiles = globFiles(
    path.join(ROOT, 'packages'),
    /\.ts$/,
    ['node_modules', 'dist', 'generated', '.spec.', '.test.']
  );

  for (const file of tsFiles) {
    if (file.includes('.spec.') || file.includes('.test.')) continue;
    const content = readFile(file);

    // Match the forbidden pattern
    if (/yourForbiddenPattern/.test(content)) {
      errors.push(
        `[your-check-name] ${relative(file)}: Explanation of what is wrong and how to fix it.`
      );
    }
  }
}
```

### Template — Two Files Must Stay In Sync check

```typescript
function checkTwoFilesSynced(): void {
  if (!config.checks['your-check-name']) return;

  const fileAPath = path.join(ROOT, '.github', 'file-a.json');
  const fileBPath = path.join(ROOT, '.github', 'file-b.env');

  if (!fs.existsSync(fileAPath)) {
    warnings.push('[your-check-name] file-a.json not found. Skipping.');
    return;
  }
  if (!fs.existsSync(fileBPath)) {
    warnings.push('[your-check-name] file-b.env not found. Skipping.');
    return;
  }

  const dataA = JSON.parse(readFile(fileAPath)) as { keys: string[] };
  const keysInB = new Set(
    readFile(fileBPath).split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => l.split('=')[0].trim())
  );

  for (const key of dataA.keys) {
    if (!keysInB.has(key)) {
      errors.push(
        `[your-check-name] Key '${key}' declared in file-a.json is missing from file-b.env.`
      );
    }
  }
}
```

---

## Step 3 — Register the Check in the Run Section

Find the `// Run` section at the bottom of `scripts/lint-standards.ts` and add your function call:

```typescript
// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log('🔍 Running coding standards checks...\n');

checkNoToObjectInEntities();
checkNoCreatedAtInEntities();
checkNoNodeEnvDevelopment();
checkErrorShapeNoTimestamp();
checkServiceRegistrySync();
checkServiceRegistryEnvSync();
checkDomainExceptionFilterExists();
checkBarrelExportCompleteness();
checkEventHandlerServiceExists();
checkYourCheckName();   // ← add here
```

---

## Step 4 — Decide: `errors` vs `warnings`

| Use | When |
|---|---|
| `errors.push(...)` | The violation must block CI. Use for rule violations that will cause runtime failures or architectural drift. |
| `warnings.push(...)` | Advisory only — CI passes but the issue is logged. Use for conventions that are desirable but not mandatory (e.g. barrel completeness). |

Prefer `errors` unless the check has many legitimate exceptions.

---

## Step 5 — Test the Check Locally

```bash
# Run just the structural linter
npx ts-node --project scripts/tsconfig.json scripts/lint-standards.ts

# Expected output on a passing workspace:
# ✅ All coding standards checks passed (10 checks enabled).

# Expected output when a violation is detected:
# ❌ Coding standard violations:
#   [your-check-name] apps/{domain}/{domain}-api-service: ...
# 1 violation(s) found. Fix them before merging.
```

---

## Step 6 — Update `docs/coding-standards.md` (Optional)

If the check enforces a new Golden Rule, append it to `docs/coding-standards.md` with its rule number and description. This keeps the human-readable reference in sync with the automated check.

---

## Utility Functions Already Available

Do not reinvent — use these helpers already defined in `lint-standards.ts`:

| Function | Signature | Purpose |
|---|---|---|
| `globFiles(dir, pattern, excludePatterns)` | `(string, RegExp, string[]) => string[]` | Recursively find files matching a regex pattern |
| `readFile(filePath)` | `(string) => string` | Read file contents as string |
| `relative(filePath)` | `(string) => string` | Convert absolute path to workspace-relative display path |

---

## Pattern Reference — Common RegEx Checks

```typescript
// Forbidden import
/from ['"]@nestjs\//.test(content)

// Method declaration in class
/toObject\s*\(/.test(content)

// Field declaration (private/readonly/etc)
/(?:(?:private|readonly|public|protected)\s+)*fieldName\s*[:(]/.test(content)

// process.env reference
/process\.env\.([A-Z_]+)/.test(content)

// String literal instead of enum constant
/['"]ACTIVE['"]/.test(content)
```
