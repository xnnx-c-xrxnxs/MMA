/**
 * lint-standards.ts — Structural coding standards checks
 *
 * Validates standards that ESLint rules cannot express: file structure, enum sync,
 * error response shapes, service registry completeness, and barrel exports.
 *
 * Run: ts-node --project scripts/tsconfig.json scripts/lint-standards.ts
 * CI:  Added as step in ci-fast-check.yml after lint
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface CheckConfig {
  [key: string]: boolean;
}

let config: { checks: CheckConfig; exclude?: string[] } = {
  checks: {
    'no-toObject-in-entities': true,
    'no-createdAt-in-entities': true,
    'no-node-env-development': true,
    'error-shape-no-timestamp': true,
    'service-registry-sync': true,
    'service-registry-env-sync': true,
    'service-config-completeness': true,
    'barrel-export-completeness': true,
    'event-handler-service-exists': true,
    'domain-exception-filter-exists': true,
    'no-scss-files': true,
    'no-dynamic-tailwind-classes': true,
    'skills-no-example-imports': true,
    'no-workspace-protocol-in-lambda-package-json': true,
    'swagger-decorators-required': true,
    'agent-frontmatter-required': true,
    'runSubagent-reference-resolves': true,
    'no-legacy-ai-config-references': true,
  },
};

const configPath = path.resolve(__dirname, '..', 'coding-standards.config.ts');
// Try loading the config (ts-node resolves .ts)
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require(configPath);
  if (loaded && loaded.default) {
    config = { ...config, ...loaded.default };
  }
} catch {
  // Use defaults if config file doesn't exist
}

const ROOT = path.resolve(__dirname, '..');
const errors: string[] = [];
const warnings: string[] = [];

// Internal tooling domains live alongside business domains under apps/ but follow different conventions:
// - they have their own deploy workflow (e.g. cd-monitoring-deploy.yml) so they do not appear in service-registry.json
// - they may use a tool-specific exception filter name (e.g. monitoring-exception.filter.ts)
// Skipped by service-registry-sync and domain-exception-filter-exists checks.
const INTERNAL_TOOL_DOMAINS = new Set(['monitoring']);

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function globFiles(dir: string, pattern: RegExp, excludePatterns: string[] = []): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(ROOT, fullPath).replace(/\\/g, '/');

    if (excludePatterns.some((p) => relative.includes(p.replace(/\*\*/g, '')))) continue;

    if (entry.isDirectory()) {
      results.push(...globFiles(fullPath, pattern, excludePatterns));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function relative(filePath: string): string {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

// ---------------------------------------------------------------------------
// Check: no-toObject-in-entities (A13)
// ---------------------------------------------------------------------------

function checkNoToObjectInEntities(): void {
  if (!config.checks['no-toObject-in-entities']) return;

  const entityDirs = globFiles(
    path.join(ROOT, 'packages'),
    /\.entity\.ts$/,
    ['node_modules', 'dist', 'generated', '.spec.']
  );

  for (const file of entityDirs) {
    if (file.includes('.spec.')) continue;
    const content = readFile(file);
    if (/toObject\s*\(/.test(content)) {
      errors.push(`[no-toObject-in-entities] ${relative(file)}: Domain entities must not have toObject() methods. Serialization is handled by Application Service → Zod schema.parse().`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check: no-createdAt-in-entities (A12)
// ---------------------------------------------------------------------------

function checkNoCreatedAtInEntities(): void {
  if (!config.checks['no-createdAt-in-entities']) return;

  const entityFiles = globFiles(
    path.join(ROOT, 'packages'),
    /\.entity\.ts$/,
    ['node_modules', 'dist', 'generated', '.spec.']
  );

  for (const file of entityFiles) {
    if (file.includes('.spec.')) continue;
    const content = readFile(file);
    // Match field declarations: `private createdAt`, `private readonly createdAt`, `createdAt:`, etc.
    if (/(?:(?:private|readonly|public|protected)\s+)*createdAt\s*[:(]/.test(content)) {
      errors.push(`[no-createdAt-in-entities] ${relative(file)}: Entity timestamps must be dateCreated + updatedAt only. Never add createdAt — OneTable manages it at persistence level.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check: no-node-env-development (B8)
// ---------------------------------------------------------------------------

function checkNoNodeEnvDevelopment(): void {
  if (!config.checks['no-node-env-development']) return;

  const tsFiles = [
    ...globFiles(path.join(ROOT, 'apps'), /\.ts$/, ['node_modules', 'dist', '.spec.', '.test.', 'generated']),
    ...globFiles(path.join(ROOT, 'packages'), /\.ts$/, ['node_modules', 'dist', '.spec.', '.test.', 'generated']),
  ];

  for (const file of tsFiles) {
    if (file.includes('.spec.') || file.includes('.test.') || file.includes('lint-standards') || file.includes('eslint-plugin')) continue;
    const content = readFile(file);
    if (/NODE_ENV\s*===?\s*['"]development['"]/.test(content)) {
      errors.push(`[no-node-env-development] ${relative(file)}: Do not use NODE_ENV === 'development'. Use STAGE === 'local' for local detection.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check: error-shape-no-timestamp (C7)
// ---------------------------------------------------------------------------

function checkErrorShapeNoTimestamp(): void {
  if (!config.checks['error-shape-no-timestamp']) return;

  const filterFiles = globFiles(
    path.join(ROOT, 'apps'),
    /domain-exception\.filter\.ts$/,
    ['node_modules', 'dist', '.spec.']
  );

  for (const file of filterFiles) {
    if (file.includes('.spec.')) continue;
    const content = readFile(file);
    if (/timestamp/.test(content)) {
      errors.push(`[error-shape-no-timestamp] ${relative(file)}: Error responses must not include 'timestamp'. Standardized shape: { statusCode, error, message }.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check: service-registry-sync (E5)
// ---------------------------------------------------------------------------

function checkServiceRegistrySync(): void {
  if (!config.checks['service-registry-sync']) return;

  const registryPath = path.join(ROOT, '.github', 'service-registry.json');
  if (!fs.existsSync(registryPath)) {
    warnings.push('[service-registry-sync] .github/service-registry.json not found. Skipping.');
    return;
  }

  const registryData = JSON.parse(readFile(registryPath)) as { apiServices?: Array<{ name: string }> };
  const registry = registryData.apiServices || [];
  const registeredNames = new Set(registry.map((s) => s.name));

  // Find all API service project.json files
  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return;

  const domainDirs = fs.readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const domain of domainDirs) {
    // Internal tooling domains have their own deploy workflows (e.g. monitoring → cd-monitoring-deploy.yml)
    // and do not belong in the main service-registry.json driving cd-deploy.yml.
    if (INTERNAL_TOOL_DOMAINS.has(domain.name)) continue;
    const domainPath = path.join(appsDir, domain.name);
    const serviceDirs = fs.readdirSync(domainPath, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const service of serviceDirs) {
      if (service.name.includes('-e2e')) continue;
      if (service.name.includes('event-handler')) continue; // Event handlers don't need registry entry

      const projectJsonPath = path.join(domainPath, service.name, 'project.json');
      if (!fs.existsSync(projectJsonPath)) continue;

      const projectJson = JSON.parse(readFile(projectJsonPath));
      const projectName = projectJson.name;

      if (projectName && projectName.includes('-api-service') && !registeredNames.has(projectName)) {
        errors.push(`[service-registry-sync] API service '${projectName}' is not registered in .github/service-registry.json. Add it for CI E2E.`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check: service-registry-env-sync (E11)
// Ensures env vars referenced in module code are declared in both
// service-registry.json envVars[] and service-registry.env.
// ---------------------------------------------------------------------------

interface RegistryService {
  name: string;
  domain: string;
  envVars?: string[];
}

function checkServiceRegistryEnvSync(): void {
  if (!config.checks['service-registry-env-sync']) return;

  const registryJsonPath = path.join(ROOT, '.github', 'service-registry.json');
  const registryEnvPath = path.join(ROOT, '.github', 'service-registry.env');

  if (!fs.existsSync(registryJsonPath)) {
    warnings.push('[service-registry-env-sync] .github/service-registry.json not found. Skipping.');
    return;
  }
  if (!fs.existsSync(registryEnvPath)) {
    warnings.push('[service-registry-env-sync] .github/service-registry.env not found. Skipping.');
    return;
  }

  const registryData = JSON.parse(readFile(registryJsonPath)) as {
    apiServices?: RegistryService[];
    eventHandlerServices?: RegistryService[];
  };

  // Parse service-registry.env into a set of declared keys
  const envFileContent = readFile(registryEnvPath);
  const envFileKeys = new Set<string>();
  for (const line of envFileContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    envFileKeys.add(trimmed.slice(0, eqIndex).trim());
  }

  const allServices: RegistryService[] = [
    ...(registryData.apiServices || []),
    ...(registryData.eventHandlerServices || []),
  ];

  // Infrastructure env var patterns that Terraform resolves and CI must provide
  const infraVarPattern = /^(?:.*_SQS_QUEUE_URL|.*_SQS_QUEUE_NAME|.*_DYNAMODB_TABLE_NAME|.*_DATABASE_URL)$/;

  // Check 1: Scan each service's module file for SQS_QUEUE_URL env var references
  // and verify they appear in the service's envVars[] in service-registry.json
  for (const svc of allServices) {
    const modulePaths = findModuleFiles(svc);
    for (const modulePath of modulePaths) {
      const content = readFile(modulePath);
      // Match: process.env.SOMETHING_SQS_QUEUE_URL
      const sqsUrlMatches = content.matchAll(/process\.env\.([A-Z_]+SQS_QUEUE_URL)/g);
      for (const match of sqsUrlMatches) {
        const envVar = match[1];
        const declaredEnvVars = svc.envVars || [];
        if (!declaredEnvVars.includes(envVar)) {
          errors.push(
            `[service-registry-env-sync] Service '${svc.name}' references process.env.${envVar} in ${relative(modulePath)} but it is not listed in its envVars[] in service-registry.json. Terraform will not inject it into the Lambda.`,
          );
        }
      }
    }
  }

  // Check 2: Every infrastructure env var declared in a service's envVars[] must
  // have a corresponding key in service-registry.env (for CI E2E)
  for (const svc of allServices) {
    const declaredEnvVars = svc.envVars || [];
    for (const envVar of declaredEnvVars) {
      if (!infraVarPattern.test(envVar)) continue; // Skip non-infra vars like FE_BASE_URL, AWS_SECRETS_ARN
      if (!envFileKeys.has(envVar)) {
        errors.push(
          `[service-registry-env-sync] Service '${svc.name}' declares '${envVar}' in envVars[] (service-registry.json) but it is not defined in service-registry.env. CI E2E tests will not have this variable.`,
        );
      }
    }
  }
}

function findModuleFiles(svc: RegistryService): string[] {
  const results: string[] = [];
  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return results;

  const domainDirs = fs.readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const domain of domainDirs) {
    const servicePath = path.join(appsDir, domain.name, svc.name, 'src', 'modules');
    if (!fs.existsSync(servicePath)) continue;

    const moduleFiles = fs.readdirSync(servicePath).filter((f) => f.endsWith('.module.ts'));
    for (const mf of moduleFiles) {
      results.push(path.join(servicePath, mf));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Check: service-config-completeness
//
// Root cause this prevents: a service references process.env.X in code, but
// X is not declared in service-registry.json envVars[] — so Terraform never
// injects it into the deployed Lambda and the service crashes at first call
// with a confusing `undefined` error. Same class of bug: main.ts forgets to
// call `SecretsConfig.resolve(['MY_DB_URL'])` so a secret-backed env var is
// undefined at runtime even though it's "configured" in Secrets Manager.
//
// For each service in apiServices + eventHandlerServices:
//   1. Walk apps/{domain}/{svc.name}/src/**/*.ts (excluding *.spec.ts) and
//      collect every `process.env.IDENTIFIER` reference.
//   2. Parse main.ts for `SecretsConfig.resolve([...keys])` and collect the
//      secret keys that get hydrated at cold-start.
//   3. For every code-referenced var that is NOT in:
//        - the service's envVars[]
//        - the SecretsConfig.resolve(...) list
//        - the ambient/runtime allowlist below
//      → ERROR. The deployed Lambda will crash.
//   4. For every var in envVars[] matching a SECRET pattern
//      (*_DATABASE_URL, *_API_KEY, *_SECRET, *_PASSWORD, *_PRIVATE_KEY) that
//      is referenced in code but NOT in SecretsConfig.resolve(...)
//      → WARN. It is probably stored in Secrets Manager and needs hydration.
//   5. For every key in SecretsConfig.resolve(...) that is NOT referenced
//      anywhere in the service code → WARN (dead secret allow-list entry).
// ---------------------------------------------------------------------------

// Vars that the Lambda runtime / Web Adapter / OTel / local dev provide
// automatically. Code may read them without declaring them in envVars[].
const AMBIENT_ENV_VARS = new Set<string>([
  // Process / runtime
  'STAGE', 'NODE_ENV', 'PORT', 'DEBUG', 'CI', 'TZ', 'FORCE_COLOR', 'PATH', 'HOME',
  // AWS Lambda runtime
  'AWS_REGION', 'AWS_DEFAULT_REGION', 'AWS_LAMBDA_FUNCTION_NAME',
  'AWS_LAMBDA_FUNCTION_VERSION', 'AWS_LAMBDA_FUNCTION_MEMORY_SIZE',
  'AWS_LAMBDA_LOG_GROUP_NAME', 'AWS_LAMBDA_LOG_STREAM_NAME',
  'AWS_LAMBDA_RUNTIME_API', 'AWS_LAMBDA_INITIALIZATION_TYPE',
  'AWS_EXECUTION_ENV', 'AWS_XRAY_DAEMON_ADDRESS', 'AWS_XRAY_CONTEXT_MISSING',
  '_HANDLER', '_X_AMZN_TRACE_ID', 'LAMBDA_TASK_ROOT', 'LAMBDA_RUNTIME_DIR',
  // Local AWS credentials (LocalStack)
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
  // Local dev infrastructure
  'LOCALSTACK_ENDPOINT', 'DYNAMODB_ENDPOINT', 'DEFAULT_REGION',
  // Telemetry (handled by @old-st/telemetry initTelemetry())
  'OTEL_SDK_DISABLED',
  // Swagger toggle (lazy require in main.ts)
  'SWAGGER_ENABLED',
  // Frontend base URL — CORS config in every API service
  'FE_BASE_URL',
]);

// Prefixes that mark whole families of allowed ambient vars.
const AMBIENT_ENV_PREFIXES = ['OTEL_', 'AWS_LWA_', 'npm_'];

// Suffixes that indicate the var is a per-service local-only var (read in
// main.ts with a hard-coded fallback — never injected in Lambda).
const AMBIENT_ENV_SUFFIXES = ['_SERVICE_PORT'];

// Patterns that strongly suggest a value lives in AWS Secrets Manager and
// MUST be hydrated by SecretsConfig.resolve() at Lambda cold-start.
const SECRET_PATTERNS = [
  /_DATABASE_URL$/,
  /_API_KEY$/,
  /_SECRET$/,
  /_SECRET_KEY$/,
  /_PASSWORD$/,
  /_PRIVATE_KEY$/,
  /_ACCESS_TOKEN$/,
  /_REFRESH_TOKEN$/,
  /_CLIENT_SECRET$/,
  // Public-ish identifiers that are ALWAYS rotated together with a private
  // counterpart and stored in the same Secrets Manager entry. Flagging these
  // as secret companions catches the "I put the private key in Secrets but
  // left its key-pair ID as a Terraform plaintext env var" mistake.
  /_KEY_PAIR_ID$/,
];

function isAmbientEnvVar(name: string): boolean {
  if (AMBIENT_ENV_VARS.has(name)) return true;
  if (AMBIENT_ENV_PREFIXES.some((p) => name.startsWith(p))) return true;
  if (AMBIENT_ENV_SUFFIXES.some((s) => name.endsWith(s))) return true;
  return false;
}

function isLikelySecret(name: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(name));
}

function findServiceSrcRoot(svcName: string): string | undefined {
  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return undefined;
  for (const domain of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!domain.isDirectory()) continue;
    const candidate = path.join(appsDir, domain.name, svcName, 'src');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return undefined;
}

function collectEnvReferences(srcRoot: string): Map<string, string[]> {
  // Returns Map<envVarName, [relativeFilePath, ...]>
  const tsFiles = globFiles(srcRoot, /\.ts$/, ['.spec.', '.test.', 'node_modules', 'dist']);
  const out = new Map<string, string[]>();
  // Match `process.env.IDENTIFIER` and `process.env['IDENTIFIER']`
  const re = /process\.env(?:\.([A-Z_][A-Z0-9_]*)|\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\])/g;
  for (const f of tsFiles) {
    const content = readFile(f);
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1] ?? m[2];
      if (!name) continue;
      const list = out.get(name) ?? [];
      if (!list.includes(f)) list.push(f);
      out.set(name, list);
    }
  }
  return out;
}

function collectSecretsResolveKeys(srcRoot: string): Set<string> {
  // Look in main.ts (and any *.ts handler files at src root) for
  // SecretsConfig.resolve(['A', 'B']) — captures string-literal arguments only.
  const out = new Set<string>();
  const candidateFiles = [
    path.join(srcRoot, 'main.ts'),
    path.join(srcRoot, 'handler.ts'),
    path.join(srcRoot, 'lambda.ts'),
  ].filter((p) => fs.existsSync(p));

  // Also include any *.ts file directly in src/ root (catches alternate entrypoints).
  for (const e of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.ts')) {
      const full = path.join(srcRoot, e.name);
      if (!candidateFiles.includes(full)) candidateFiles.push(full);
    }
  }

  // Capture the full `SecretsConfig.resolve( ... )` argument list (single line
  // or multi-line) and extract string literals from it.
  const callRe = /SecretsConfig\.resolve\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
  const literalRe = /['"]([A-Z_][A-Z0-9_]*)['"]/g;
  for (const f of candidateFiles) {
    const content = readFile(f);
    let m: RegExpExecArray | null;
    while ((m = callRe.exec(content)) !== null) {
      const inner = m[1];
      let lm: RegExpExecArray | null;
      while ((lm = literalRe.exec(inner)) !== null) {
        out.add(lm[1]);
      }
    }
  }
  return out;
}

function checkServiceConfigCompleteness(): void {
  if (!config.checks['service-config-completeness']) return;

  const registryJsonPath = path.join(ROOT, '.github', 'service-registry.json');
  if (!fs.existsSync(registryJsonPath)) {
    warnings.push('[service-config-completeness] .github/service-registry.json not found. Skipping.');
    return;
  }

  const registryData = JSON.parse(readFile(registryJsonPath)) as {
    apiServices?: RegistryService[];
    eventHandlerServices?: RegistryService[];
  };

  const allServices: RegistryService[] = [
    ...(registryData.apiServices || []),
    ...(registryData.eventHandlerServices || []),
  ];

  for (const svc of allServices) {
    const srcRoot = findServiceSrcRoot(svc.name);
    if (!srcRoot) continue;

    const referenced = collectEnvReferences(srcRoot);
    const resolvedSecrets = collectSecretsResolveKeys(srcRoot);
    const declared = new Set<string>(svc.envVars ?? []);

    // (1) Every referenced env var must be provided by SOMETHING.
    for (const [name, files] of referenced.entries()) {
      if (isAmbientEnvVar(name)) continue;
      if (declared.has(name)) continue;
      if (resolvedSecrets.has(name)) continue;

      const firstFile = relative(files[0]);
      errors.push(
        `[service-config-completeness] Service '${svc.name}' reads process.env.${name} (in ${firstFile}` +
        `${files.length > 1 ? ` and ${files.length - 1} other file(s)` : ''}) but '${name}' is NOT declared in service-registry.json → ${svc.name}.envVars[] AND NOT hydrated by SecretsConfig.resolve([...]) in main.ts. ` +
        `The deployed Lambda will see 'undefined' at runtime. Fix: add '${name}' to envVars[] (Terraform-injected) OR add it to SecretsConfig.resolve([...]) (Secrets Manager-hydrated).`,
      );
    }

    // (2) envVars[] entries that LOOK like secrets but aren't resolved at
    //     cold-start are almost always a deploy-time bug.
    for (const name of declared) {
      if (!isLikelySecret(name)) continue;
      if (!referenced.has(name)) continue; // Only warn if code actually reads it
      if (resolvedSecrets.has(name)) continue;

      warnings.push(
        `[service-config-completeness] Service '${svc.name}' declares '${name}' in envVars[] and reads it in code, but main.ts does NOT call SecretsConfig.resolve(['${name}', ...]). ` +
        `Name matches a secret pattern (e.g. *_DATABASE_URL, *_API_KEY, *_SECRET) — if this value is stored in AWS Secrets Manager you MUST add it to the resolve() allow-list at the top of main.ts, otherwise it will be 'undefined' in Lambda.`,
      );
    }

    // (3) Keys in SecretsConfig.resolve([...]) that are not used anywhere in
    //     the service code are likely stale / copy-pasted.
    for (const key of resolvedSecrets) {
      if (referenced.has(key)) continue;
      warnings.push(
        `[service-config-completeness] Service '${svc.name}' calls SecretsConfig.resolve(['${key}', ...]) in main.ts but no source file under apps/.../${svc.name}/src/ reads process.env.${key}. Remove the dead allow-list entry to keep cold-start lean.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check: domain-exception-filter-exists (A9)
// ---------------------------------------------------------------------------

function checkDomainExceptionFilterExists(): void {
  if (!config.checks['domain-exception-filter-exists']) return;

  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return;

  const domainDirs = fs.readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const domain of domainDirs) {
    // Internal tooling domains (e.g. monitoring) ship their own exception filter named after the tool.
    if (INTERNAL_TOOL_DOMAINS.has(domain.name)) continue;
    const domainPath = path.join(appsDir, domain.name);
    if (!fs.existsSync(domainPath) || !fs.statSync(domainPath).isDirectory()) continue;

    const serviceDirs = fs.readdirSync(domainPath, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const service of serviceDirs) {
      if (service.name.includes('-e2e') || service.name.includes('event-handler')) continue;
      if (!service.name.includes('-api-service')) continue;

      const filterPath = path.join(domainPath, service.name, 'src', 'presentation', 'filters', 'domain-exception.filter.ts');
      if (!fs.existsSync(filterPath)) {
        errors.push(`[domain-exception-filter-exists] ${domain.name}/${service.name} is missing presentation/filters/domain-exception.filter.ts. Every API service needs a DomainExceptionFilter.`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check: barrel-export-completeness (E10)
// ---------------------------------------------------------------------------

function checkBarrelExportCompleteness(): void {
  if (!config.checks['barrel-export-completeness']) return;

  const packageDirs = ['packages'];
  const excludeNames = new Set(['node_modules', 'dist', 'generated', 'prisma', 'migrations', '__mocks__', 'schemas', 'configs', 'rules']);

  for (const pkgBase of packageDirs) {
    const basePath = path.join(ROOT, pkgBase);
    if (!fs.existsSync(basePath)) continue;

    const packages = fs.readdirSync(basePath, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const pkg of packages) {
      const srcDir = path.join(basePath, pkg.name, 'src');
      if (!fs.existsSync(srcDir)) continue;

      checkBarrelRecursive(srcDir, excludeNames);
    }
  }
}

function checkBarrelRecursive(dir: string, excludeNames: Set<string>): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const subdirs = entries.filter((e) => e.isDirectory() && !excludeNames.has(e.name));
  const hasIndexTs = entries.some((e) => e.isFile() && e.name === 'index.ts');

  // Only check directories that contain .ts files (not just subdirectories)
  const hasTsFiles = entries.some((e) => e.isFile() && e.name.endsWith('.ts') && e.name !== 'index.ts' && !e.name.includes('.spec.'));

  if (hasTsFiles && !hasIndexTs && subdirs.length === 0) {
    // Skip use-case leaf directories — they use single-file-per-folder pattern and are
    // re-exported via the parent use-cases/index.ts barrel.
    const dirName = path.basename(dir);
    const parentName = path.basename(path.dirname(dir));
    if (parentName === 'use-cases' || dir.replace(/\\/g, '/').includes('/use-cases/')) {
      // Use-case subdirectories are exempt from barrel requirement
    } else {
      warnings.push(`[barrel-export-completeness] ${relative(dir)}: Missing index.ts barrel export.`);
    }
  }

  for (const subdir of subdirs) {
    checkBarrelRecursive(path.join(dir, subdir.name), excludeNames);
  }
}

// ---------------------------------------------------------------------------
// Check: event-handler-service-exists (new standard)
// ---------------------------------------------------------------------------

function checkEventHandlerServiceExists(): void {
  if (!config.checks['event-handler-service-exists']) return;

  // Domains that publish events should have a corresponding event handler service
  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return;

  const domainDirs = fs.readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const domain of domainDirs) {
    const domainPath = path.join(appsDir, domain.name);
    if (!fs.existsSync(domainPath) || !fs.statSync(domainPath).isDirectory()) continue;

    const serviceDirs = fs.readdirSync(domainPath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

    // Check if any API service publishes events (has SQS publisher imports)
    const apiServices = serviceDirs.filter((s) => s.includes('-api-service') && !s.includes('-e2e'));
    const eventHandlers = serviceDirs.filter((s) => s.includes('-event-handler-service'));

    for (const apiService of apiServices) {
      const srcDir = path.join(domainPath, apiService, 'src');
      if (!fs.existsSync(srcDir)) continue;

      const allFiles = globFiles(srcDir, /\.ts$/, ['node_modules', 'dist', '.spec.']);
      const publishesEvents = allFiles.some((f) => {
        const content = readFile(f);
        return /IEventPublisher|SqsStandardEventPublisher|SqsFifoEventPublisher/.test(content);
      });

      if (publishesEvents && eventHandlers.length === 0) {
        errors.push(`[event-handler-service-exists] Domain '${domain.name}' publishes events from ${apiService} but has no event-handler-service. Create a dedicated {domain}-event-handler-service.`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check: app-service-has-logger (B35 — Golden Rule #35)
// ---------------------------------------------------------------------------

function checkAppServiceHasLogger(): void {
  if (!config.checks['app-service-has-logger']) return;

  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return;

  // Find all application service files across all services
  const serviceFiles = globFiles(
    appsDir,
    /\.service\.ts$/,
    ['node_modules', 'dist', 'generated', '.spec.', '.test.', 'e2e']
  ).filter((f) => {
    const rel = relative(f);
    // Only application services, not infrastructure or SQS local services
    return rel.includes('/application/services/') && !rel.includes('.spec.');
  });

  for (const file of serviceFiles) {
    const content = readFile(file);
    const rel = relative(file);

    // Check for createLogger import
    const hasCreateLogger = /import\s+.*createLogger.*from\s+['"]@old-st\/telemetry['"]/.test(content);

    // Check for module-level logger declaration
    const hasLoggerDeclaration = /const\s+logger\s*=\s*createLogger\(/.test(content);

    // Check for forbidden new Logger() pattern
    const hasNestLogger = /new\s+Logger\s*\(/.test(content);

    if (hasNestLogger) {
      errors.push(
        `[app-service-has-logger] ${rel}: Uses 'new Logger()' from @nestjs/common. ` +
        `Use 'const logger = createLogger(...)' from @old-st/telemetry instead (Golden Rule #35).`
      );
    }

    if (!hasCreateLogger || !hasLoggerDeclaration) {
      // Allow monitoring read-only services (MonitoringService) to skip logging
      // by checking if the file has any async methods (mutating or not)
      const hasMethods = /async\s+\w+\s*\(/.test(content);
      if (!hasMethods) continue;

      errors.push(
        `[app-service-has-logger] ${rel}: Missing 'const logger = createLogger(...)' ` +
        `from @old-st/telemetry. Every application service must have a module-level ` +
        `structured logger (Golden Rule #35).`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check: no-userId-in-controller-input (B45 — Golden Rule #45)
//
// Controllers must NEVER read userId, actorId, performedBy, requesterId, or
// similar identity fields from @Body(), @Query(), or @Param() — those values
// must come from the JWT via @CurrentUser(). Allowing the client to supply
// these is the canonical "broken access control" vulnerability.
//
// Exceptions:
//   - `:userId` / `:targetUserId` in routes that operate on OTHER users
//     (e.g. admin lookups: GET /users/:userId, PATCH /users/:userId/role).
//     These are permitted because they identify the SUBJECT of the action,
//     not the actor. The actor must still be verified via @CurrentUser().
// ---------------------------------------------------------------------------

function checkNoUserIdInControllerInput(): void {
  if (!config.checks['no-userId-in-controller-input']) return;

  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return;

  const controllerFiles = globFiles(
    appsDir,
    /\.controller\.ts$/,
    ['node_modules', 'dist', 'generated', '.spec.', '.test.', 'e2e']
  );

  // Forbidden actor-identity field names inside @Body / @Query schemas.
  // We grep for direct usage in @Body()/@Query() destructuring — a cheap
  // heuristic that catches the common mistakes without needing a TS AST walk.
  const ACTOR_FIELDS = [
    'actorId',
    'performedBy',
    'requesterId',
    'currentUserId',
  ];
  const fieldUnion = ACTOR_FIELDS.join('|');
  // Match destructured @Body or @Query that pulls one of those fields:
  //   @Body() body: { actorId: string; ... }
  //   @Body('actorId') id: string
  const bodyPattern = new RegExp(
    `@(?:Body|Query)\\([^)]*\\)\\s+\\w+\\s*:[^;]*\\b(${fieldUnion})\\b`,
    'g',
  );
  const fieldArgPattern = new RegExp(
    `@(?:Body|Query)\\(\\s*['"](${fieldUnion})['"]\\s*\\)`,
    'g',
  );

  for (const file of controllerFiles) {
    const content = readFile(file);
    const rel = relative(file);

    let match: RegExpExecArray | null;
    while ((match = bodyPattern.exec(content)) !== null) {
      errors.push(
        `[no-userId-in-controller-input] ${rel}: Controller reads '${match[1]}' from @Body/@Query. ` +
        `Actor identity must be sourced from the JWT via @CurrentUser() — never from client input (Golden Rule #45).`
      );
    }
    while ((match = fieldArgPattern.exec(content)) !== null) {
      errors.push(
        `[no-userId-in-controller-input] ${rel}: Controller binds '${match[1]}' from @Body/@Query argument. ` +
        `Actor identity must be sourced from the JWT via @CurrentUser() — never from client input (Golden Rule #45).`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check: gateway-public-routes-sync
//
// Every controller method decorated with @Public() must have a matching entry
// in service-registry.json → gatewayAuth.publicRoutes for the SAME service.
// Without this, the API Gateway JWT authorizer will reject the request with
// 401 BEFORE it reaches the Lambda's @Public() bypass.
//
// We can't fully derive HTTP method + path from source without a TS AST walk,
// so the heuristic is:
//   - For each service in apiServices, count @Public() occurrences in its
//     controllers under apps/{...}/src/...
//   - For each service, count entries in publicRoutes filtered by service name
//   - Counts must match. If not, emit a violation pointing at the diff.
// This catches the common drift case: a developer adds @Public() but forgets
// to update the registry (or vice-versa).
// ---------------------------------------------------------------------------

function checkGatewayPublicRoutesSync(): void {
  if (!config.checks['gateway-public-routes-sync']) return;

  const registryPath = path.join(ROOT, '.github', 'service-registry.json');
  if (!fs.existsSync(registryPath)) return;
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as {
    apiServices?: Array<{ name: string; domain: string }>;
    gatewayAuth?: {
      enabled?: boolean;
      publicRoutes?: Array<{ service: string; method: string; path: string }>;
    };
  };

  const apiServices = registry.apiServices ?? [];
  const publicRoutes = registry.gatewayAuth?.publicRoutes ?? [];

  // Build per-service expected count from registry
  const registryCounts = new Map<string, number>();
  for (const r of publicRoutes) {
    registryCounts.set(r.service, (registryCounts.get(r.service) ?? 0) + 1);
  }

  // Validate every public route references a known service
  const knownServices = new Set(apiServices.map((s) => s.name));
  for (const r of publicRoutes) {
    if (!knownServices.has(r.service)) {
      errors.push(
        `[gateway-public-routes-sync] gatewayAuth.publicRoutes references unknown service '${r.service}'. ` +
        `Add it to apiServices or remove the route entry.`,
      );
    }
  }

  // For each API service, count @Public() occurrences in its controllers
  // and compare against the registry count.
  for (const svc of apiServices) {
    // Resolve the service folder by name. Convention is apps/{plural}/{name}/.
    const svcRoot = findServiceRoot(svc.name);
    if (!svcRoot) continue;

    const controllerFiles = globFiles(
      svcRoot,
      /\.controller\.ts$/,
      ['node_modules', 'dist', '.spec.', '.test.'],
    );

    let codeCount = 0;
    for (const f of controllerFiles) {
      const content = readFile(f);
      const matches = content.match(/@Public\s*\(\s*\)/g);
      if (matches) codeCount += matches.length;
    }

    const registryCount = registryCounts.get(svc.name) ?? 0;
    // Registry count includes 3 Swagger routes per service which are NOT
    // @Public() routes (they are gated by env-conditional Swagger setup, not
    // the decorator): /api/swagger, /api/swagger-json, /api/swagger/{proxy+}.
    // The {proxy+} entry is required so the Swagger UI static bundle assets
    // (swagger-ui-bundle.js, .css, favicon, etc.) can load through the gateway
    // without 401. Subtract a fixed allowance of 3 per service to compare
    // apples-to-apples. If a service does not enable Swagger this is still
    // safe — it just means the registry has 3 unused entries that map to 404
    // routes (harmless).
    const SWAGGER_ROUTE_ALLOWANCE = 3;
    const registryCodeEquivalent = Math.max(0, registryCount - SWAGGER_ROUTE_ALLOWANCE);

    if (codeCount !== registryCodeEquivalent) {
      errors.push(
        `[gateway-public-routes-sync] ${svc.name}: @Public() decorators in code = ${codeCount}, ` +
        `but registry has ${registryCount} public routes (= ${registryCodeEquivalent} after subtracting ${SWAGGER_ROUTE_ALLOWANCE} Swagger routes). ` +
        `Add or remove entries in .github/service-registry.json → gatewayAuth.publicRoutes so they match.`,
      );
    }
  }
}

function findServiceRoot(svcName: string): string | undefined {
  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return undefined;
  for (const domainDir of fs.readdirSync(appsDir)) {
    const candidate = path.join(appsDir, domainDir, svcName);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Check: no-workspace-protocol-in-lambda-package-json
//
// Lambda-deployed services (apiServices + eventHandlerServices in
// service-registry.json) get packaged via:
//   1. @nx/js:prune-lockfile
//   2. zip -r
//   3. npm install --omit=dev (inside dist/) at deploy time
//
// If the service ships a per-app package.json with 'workspace:*' deps,
// @nx/js:prune-lockfile leaves the 'workspace:*' strings intact in
// dist/package.json. npm doesn't understand that protocol and the deploy
// step crashes with EUNSUPPORTEDPROTOCOL.
//
// The fix is to not ship a per-app package.json for Lambda services at all
// (the Nx generator does not create one) — prune-lockfile derives one from
// the workspace lockfile. If a per-app package.json IS required, deps must
// be pinned to real versions, never 'workspace:*'.
//
// Webapp / mobile / monitoring-webapp are NOT in service-registry.json and
// have their own deploy flow — they are exempt from this check.
// ---------------------------------------------------------------------------

function checkNoWorkspaceProtocolInLambdaPackageJson(): void {
  if (!config.checks['no-workspace-protocol-in-lambda-package-json']) return;

  const registryPath = path.join(ROOT, '.github', 'service-registry.json');
  if (!fs.existsSync(registryPath)) {
    warnings.push('[no-workspace-protocol-in-lambda-package-json] .github/service-registry.json not found. Skipping.');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let registry: any;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  } catch (err) {
    warnings.push(`[no-workspace-protocol-in-lambda-package-json] Failed to parse service-registry.json: ${(err as Error).message}`);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lambdaServices: any[] = [
    ...(registry.apiServices ?? []),
    ...(registry.eventHandlerServices ?? []),
  ];

  for (const svc of lambdaServices) {
    if (!svc.distPath || typeof svc.distPath !== 'string') continue;
    // distPath e.g. "dist/apps/files/file-api-service/main.js" — derive the source dir.
    const sourceDir = path.dirname(svc.distPath).replace(/^dist[/\\]/, '');
    const pkgPath = path.join(ROOT, sourceDir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    let raw: string;
    try {
      raw = fs.readFileSync(pkgPath, 'utf-8');
    } catch {
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pkg: any;
    try {
      pkg = JSON.parse(raw);
    } catch (err) {
      errors.push(
        `[no-workspace-protocol-in-lambda-package-json] ${relative(pkgPath)}: invalid JSON (${(err as Error).message}).`,
      );
      continue;
    }

    const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    const offenders: string[] = [];
    for (const section of sections) {
      const deps = pkg[section];
      if (!deps || typeof deps !== 'object') continue;
      for (const [name, version] of Object.entries(deps)) {
        if (typeof version === 'string' && version.startsWith('workspace:')) {
          offenders.push(`${section}.${name} = "${version}"`);
        }
      }
    }

    if (offenders.length > 0) {
      errors.push(
        `[no-workspace-protocol-in-lambda-package-json] ${relative(pkgPath)}: Lambda service '${svc.name}' ships a per-app package.json that uses the 'workspace:' protocol — this will break the CD deploy step with EUNSUPPORTEDPROTOCOL when 'npm install --omit=dev' runs against dist/package.json. Offending entries: ${offenders.join(', ')}. Fix: delete this per-app package.json (recommended — let @nx/js:prune-lockfile generate one), OR pin every dep to a real version string.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check: swagger-decorators-required
//
// Root cause this prevents: in NestJS, Swagger UI's "Try it out" panel only
// renders body / query / path input fields when the OpenAPI document declares
// them. The document is built from explicit @ApiBody / @ApiQuery / @ApiParam
// decorators (or from class-DTOs with @ApiProperty). This codebase uses Zod
// schemas (z.infer<>) for body validation — those types are erased at runtime
// and NestJS reflection sees parameters as `Object` / `String`. Without
// explicit decorators every operation in the OpenAPI document is empty, so
// Swagger UI shows ONLY an Execute button — no body editor, no query inputs,
// no path field. Forked projects then ship broken-looking Swagger docs.
//
// Rules enforced (every *.controller.ts under apps/{domain}/{service}/
// src/presentation/controllers/):
//   1. Controller class MUST be decorated with @ApiTags(...).
//   2. Every route method (decorated with @Get/@Post/@Put/@Patch/@Delete)
//      MUST be decorated with @ApiOperation(...).
//   3. Every method that has a @Body() parameter MUST have an @ApiBody(...)
//      decorator on that method.
//   4. Every method that has a @Query('name') parameter MUST have a matching
//      @ApiQuery({ name: 'name', ... }) decorator on that method.
//   5. Every method that has a @Param('name') parameter MUST have a matching
//      @ApiParam({ name: 'name', ... }) decorator on that method.
//
// Naked @Query() / @Param() / @Body() (no argument) is allowed for body in
// some patterns but for query/param we require the name form so we can match
// to @ApiQuery({ name }).
//
// Exempt:
//   - examples/ (frozen reference tree)
//   - controllers inside */e2e/ projects
// ---------------------------------------------------------------------------

function checkSwaggerDecoratorsRequired(): void {
  if (!config.checks['swagger-decorators-required']) return;

  const appsDir = path.join(ROOT, 'apps');
  if (!fs.existsSync(appsDir)) return;

  const controllerFiles = globFiles(
    appsDir,
    /\.controller\.ts$/,
    ['node_modules', 'dist', 'generated', '.spec.', '.test.', '-e2e', 'examples'],
  ).filter((f) => relative(f).includes('/presentation/controllers/'));

  // Route HTTP-method decorators that mark a method as a request handler.
  const routeDecoratorRe =
    /^\s*@(?:Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(/;
  // Param decorators we care about, with optional ('name') argument.
  const bodyParamRe = /@Body\s*\(/;
  const queryParamRe = /@Query\s*\(\s*['"]([\w-]+)['"]/g;
  const pathParamRe = /@Param\s*\(\s*['"]([\w-]+)['"]/g;

  for (const file of controllerFiles) {
    const content = readFile(file);
    const rel = relative(file);

    // Controller-level: @ApiTags(...)
    if (!/@ApiTags\s*\(/.test(content)) {
      errors.push(
        `[swagger-decorators-required] ${rel}: Controller class is missing @ApiTags(...). ` +
          `Add @ApiTags('${path
            .basename(file)
            .replace('.controller.ts', 's')}') above @Controller(...). See swagger-controller-docs skill.`,
      );
    }

    // Split into method blocks. A method block starts at a route decorator and
    // extends through the parameter list (we look at the next ~25 lines after
    // a route decorator, which covers any realistic controller method).
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!routeDecoratorRe.test(lines[i])) continue;

      // Find the end of the parameter list — first ')' after the method signature.
      // Capture decorators starting from the route decorator backwards until a
      // blank line / closing brace, and signature forwards until the next '{'.
      let startLine = i;
      // Walk back to capture sibling decorators (@HttpCode, @ApiOperation, etc.).
      while (
        startLine > 0 &&
        (/^\s*@[A-Z]/.test(lines[startLine - 1]) || /^\s*\/\//.test(lines[startLine - 1]))
      ) {
        startLine--;
      }
      // Walk forward to find the opening `{` of the method body. The method
      // body starts at the first `{` that is at paren-depth 0 AFTER we have
      // passed the route decorator's own `(...)` and the method signature's
      // `(...)`. We track paren depth starting from line i; whenever depth
      // returns to 0 and we then hit `{`, that's the body start.
      let bodyStart = -1;
      let depth = 0;
      const maxScan = Math.min(lines.length, i + 80);
      scan: for (let j = i; j < maxScan; j++) {
        for (const ch of lines[j]) {
          if (ch === '(') depth++;
          else if (ch === ')') depth--;
          else if (ch === '{' && depth === 0) {
            // Skip object-literal `{` inside decorator args — those are at
            // depth>0 because they are inside `(...)`. So if depth===0 here
            // we are past the parameter list.
            bodyStart = j;
            break scan;
          }
        }
      }
      const endLine = bodyStart !== -1 ? bodyStart : Math.min(lines.length - 1, i + 30);

      const block = lines.slice(startLine, endLine + 1).join('\n');

      // (Sanity check removed — we already matched routeDecoratorRe on
      // lines[i], so the block is guaranteed to contain it. A regex anchored
      // with ^ would fail here because walk-back includes preceding decorators
      // like @Public() / @ApiTags() so the block does not start with @Post.)

      // Extract a stable method label (the line just after the parameter list end).
      const methodLabel = (() => {
        for (let j = i; j < endLine + 1; j++) {
          const m = lines[j].match(/\b(async\s+)?(\w+)\s*\(/);
          if (m && m[2] && !/^(?:Get|Post|Put|Patch|Delete|Options|Head|All|UsePipes|UseGuards|UseInterceptors|HttpCode|Public|ApiTags|ApiOperation|ApiBody|ApiQuery|ApiParam|ApiOkResponse|ApiCreatedResponse|ApiNoContentResponse|ApiBadRequestResponse|ApiNotFoundResponse|ApiConflictResponse|ApiInternalServerErrorResponse|ApiBearerAuth|ApiResponse|Body|Query|Param|Headers|Req|Res|CurrentUser)$/.test(m[2])) {
            return m[2];
          }
        }
        return `line ${i + 1}`;
      })();

      // (1) @ApiOperation required.
      if (!/@ApiOperation\s*\(/.test(block)) {
        errors.push(
          `[swagger-decorators-required] ${rel}:${i + 1} — Route handler '${methodLabel}' is missing @ApiOperation({ summary: '...' }). Without it Swagger UI shows no description.`,
        );
      }

      // (2) @Body() needs @ApiBody.
      if (bodyParamRe.test(block) && !/@ApiBody\s*\(/.test(block)) {
        errors.push(
          `[swagger-decorators-required] ${rel}:${i + 1} — Route handler '${methodLabel}' has a @Body() parameter but no @ApiBody({ schema: { type: 'object' as const, properties: {...}, required: [...] } }). Without it Swagger UI's "Try it out" panel renders only an Execute button — no body fields. (Reason: Zod z.infer<> types are erased at runtime; NestJS reflection cannot derive the schema.)`,
        );
      }

      // (3) Every @Query('name') needs a matching @ApiQuery({ name }).
      queryParamRe.lastIndex = 0;
      const queryNames = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = queryParamRe.exec(block)) !== null) queryNames.add(m[1]);
      for (const name of queryNames) {
        const apiQ = new RegExp(`@ApiQuery\\s*\\(\\s*\\{[^}]*name\\s*:\\s*['\"]${name}['\"]`);
        if (!apiQ.test(block)) {
          errors.push(
            `[swagger-decorators-required] ${rel}:${i + 1} — Route handler '${methodLabel}' reads @Query('${name}') but has no matching @ApiQuery({ name: '${name}', ... }). Swagger UI will not render an input field for this parameter.`,
          );
        }
      }

      // (4) Every @Param('name') needs a matching @ApiParam({ name }).
      pathParamRe.lastIndex = 0;
      const paramNames = new Set<string>();
      while ((m = pathParamRe.exec(block)) !== null) paramNames.add(m[1]);
      for (const name of paramNames) {
        const apiP = new RegExp(`@ApiParam\\s*\\(\\s*\\{[^}]*name\\s*:\\s*['\"]${name}['\"]`);
        if (!apiP.test(block)) {
          errors.push(
            `[swagger-decorators-required] ${rel}:${i + 1} — Route handler '${methodLabel}' reads @Param('${name}') but has no matching @ApiParam({ name: '${name}', ... }). Swagger UI will not render an input field for this path parameter.`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check: no-scss-files (frontend styling discipline)
// ---------------------------------------------------------------------------

function checkNoScssFiles(): void {
  if (!config.checks['no-scss-files']) return;

  const scopes = ['packages/ui', 'packages/mobile-ui', 'apps/webapp', 'apps/mobile'];
  const forbidden = /\.(scss|sass|styled\.ts|styled\.tsx|emotion\.ts|emotion\.tsx)$/;

  for (const scope of scopes) {
    const base = path.join(ROOT, scope);
    if (!fs.existsSync(base)) continue;

    const matches = globFiles(base, forbidden, ['node_modules', 'dist', '.next', 'generated', 'coverage']);
    for (const file of matches) {
      errors.push(
        `[no-scss-files] ${relative(file)}: SCSS / Sass / styled-components / Emotion are forbidden. Use Tailwind utilities + cva (see fe-design-tokens skill).`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Check: ui-primitive-has-story-and-spec
//
// Every component file under packages/ui/src/components/{category}/{name}/
// MUST ship the four-file bundle: {name}.tsx + index.ts + {name}.stories.tsx
// + {name}.spec.tsx. Stories are the canonical visual reference; specs
// contribute to the 70% coverage target (Golden Rule #23n).
//
// BACKFILL_ALLOWLIST contains primitives that pre-date the rule. The list is
// intentionally empty — every primitive in @old-st/ui now ships the full
// four-file bundle. New primitives MUST NOT be added here; instead, ship
// the matching .stories.tsx and .spec.tsx files alongside the implementation.
// ---------------------------------------------------------------------------

const UI_PRIMITIVE_BACKFILL_ALLOWLIST = new Set<string>([]);

function checkUiPrimitiveHasStoryAndSpec(): void {
  if (!config.checks['ui-primitive-has-story-and-spec']) return;

  const componentsRoot = path.join(ROOT, 'packages/ui/src/components');
  if (!fs.existsSync(componentsRoot)) return;

  for (const category of fs.readdirSync(componentsRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryDir = path.join(componentsRoot, category.name);

    for (const primitive of fs.readdirSync(categoryDir, { withFileTypes: true })) {
      if (!primitive.isDirectory()) continue;
      const primitiveDir = path.join(categoryDir, primitive.name);
      const name = primitive.name;
      const key = `${category.name}/${name}`;

      const required: Record<string, string> = {
        implementation: path.join(primitiveDir, `${name}.tsx`),
        barrel: path.join(primitiveDir, 'index.ts'),
        stories: path.join(primitiveDir, `${name}.stories.tsx`),
        spec: path.join(primitiveDir, `${name}.spec.tsx`),
      };

      // Skip folders that don't yet contain the implementation — the rule only
      // applies once the primitive itself exists. This keeps the check
      // tolerant of in-progress scaffolds and unrelated subfolders.
      if (!fs.existsSync(required.implementation)) continue;

      // Pre-existing primitives are grandfathered. Remove from the allowlist
      // once their story + spec are backfilled.
      const allowlisted = UI_PRIMITIVE_BACKFILL_ALLOWLIST.has(key);

      for (const [kind, filePath] of Object.entries(required)) {
        if (fs.existsSync(filePath)) continue;
        // Implementation + barrel are mandatory for everyone — even allowlisted
        // primitives must keep their .tsx and index.ts.
        if (allowlisted && (kind === 'stories' || kind === 'spec')) continue;
        errors.push(
          `[ui-primitive-has-story-and-spec] ${relative(filePath)}: missing ${kind} file. Every @old-st/ui primitive must ship {name}.tsx + index.ts + {name}.stories.tsx + {name}.spec.tsx (see webapp-ui-primitive skill § Stories / § Tests).`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check: no-dynamic-tailwind-classes
//
// Tailwind v4's JIT compiler only emits CSS for class names it can statically
// see in source. Template-literal interpolation like
//   className={`bg-${prefix}-${step}`}
// silently produces NO styles — the swatch renders as a transparent box.
//
// Detected pattern: a className= attribute whose backtick template contains a
// `${...}` interpolation directly preceded by a Tailwind-prefix token
// (bg-/text-/border-/ring-/fill-/stroke-/from-/to-/via-/grid-cols-/grid-rows-/
//  col-span-/row-span-/w-/h-/p[xytrbl]?-/m[xytrbl]?-/gap-/space-[xy]-/rounded-/
//  shadow-).
//
// Allowed alternatives:
//   1. Literal cva() map:  variant: { brand: 'bg-brand', danger: 'bg-danger' }
//   2. @source inline safelist in globals.css for known dynamic surfaces
//   3. Inline style={{ backgroundColor: token }} for fully-dynamic values
//
// Scope: apps/webapp + packages/ui + packages/mobile-ui (the only places that
// produce Tailwind CSS). Mobile RN code uses StyleSheet, not Tailwind, but the
// scan is harmless there because RN files don't use className= patterns.
// ---------------------------------------------------------------------------

function checkNoDynamicTailwindClasses(): void {
  if (!config.checks['no-dynamic-tailwind-classes']) return;

  const scopes = ['apps/webapp', 'packages/ui', 'packages/mobile-ui'];
  const prefixGroup =
    '(?:bg|text|border|ring|fill|stroke|from|to|via|grid-cols|grid-rows|col-span|row-span|' +
    'w|h|min-w|max-w|min-h|max-h|p[xytrbl]?|m[xytrbl]?|gap|space-[xy]|rounded|shadow|opacity|z|order)';
  // className=... contains a backtick string with `<prefix>-${...}` inside.
  const dynamicClass = new RegExp(
    'className\\s*=\\s*\\{?\\s*`[^`]*\\b' + prefixGroup + '-\\$\\{[^}]+\\}',
    'm',
  );
  const fileFilter = /\.(tsx|jsx)$/;

  for (const scope of scopes) {
    const base = path.join(ROOT, scope);
    if (!fs.existsSync(base)) continue;

    const files = globFiles(base, fileFilter, [
      'node_modules',
      'dist',
      '.next',
      'generated',
      'coverage',
      '.storybook',
    ]);
    for (const file of files) {
      const content = readFile(file);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (dynamicClass.test(line)) {
          errors.push(
            `[no-dynamic-tailwind-classes] ${relative(file)}:${idx + 1} — Tailwind v4 JIT does not see template-literal class names. Use a cva() literal map, an @source inline safelist, or style={{ ... }} for dynamic values.`,
          );
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Check: skills-no-example-imports
//
// The knowledge layer (.github/, docs/, top-level READMEs, lint config) and
// universal packages (packages/ui, packages/mobile-ui, packages/client-common,
// apps/auth, apps/files, apps/monitoring) must NOT reference example domains
// (user / product / order / payment) or examples/ paths except as explicit
// markdown links to examples/ (see docs/decisions/001-examples-frozen-isolated-workspace.md).
//
// Implementation: shells out to scripts/audit-example-refs.mjs which performs
// the actual scan + categorisation and emits tmp/example-refs-report.json.
// We re-read the report and surface any non-exception matches as errors.
// ---------------------------------------------------------------------------

interface AuditMatch {
  file: string;
  line: number;
  pattern: string;
  match: string;
  context: string;
  lineText: string;
  allowedException: boolean;
}

interface AuditReport {
  generatedAt: string;
  totalMatches: number;
  matches: AuditMatch[];
}

function checkSkillsNoExampleImports(): void {
  if (!config.checks['skills-no-example-imports']) return;

  const scriptPath = path.join(ROOT, 'scripts', 'audit-example-refs.mjs');
  if (!fs.existsSync(scriptPath)) {
    warnings.push(
      `[skills-no-example-imports] scripts/audit-example-refs.mjs not found — skipping check.`,
    );
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawnSync } = require('child_process') as typeof import('child_process');
  const result = spawnSync(process.execPath, [scriptPath, '--quiet'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (result.error) {
    warnings.push(`[skills-no-example-imports] failed to invoke audit script: ${result.error.message}`);
    return;
  }

  const reportPath = path.join(ROOT, 'tmp', 'example-refs-report.json');
  if (!fs.existsSync(reportPath)) {
    warnings.push(`[skills-no-example-imports] audit report missing: ${reportPath}`);
    return;
  }

  let report: AuditReport;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as AuditReport;
  } catch (err) {
    warnings.push(
      `[skills-no-example-imports] failed to parse audit report: ${(err as Error).message}`,
    );
    return;
  }

  const violations = report.matches.filter((m) => !m.allowedException);
  if (violations.length === 0) return;

  // Deduplicate (same file+line+match shows up once even if multiple patterns match).
  const seen = new Set<string>();
  for (const v of violations) {
    const key = `${v.file}:${v.line}:${v.match}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push(
      `[skills-no-example-imports] ${v.file}:${v.line} — references example domain "${v.match}" (pattern: ${v.pattern}). ` +
        `Use {domain}/{Entity} placeholders, or wrap as a markdown link to examples/ (e.g. [examples/path](examples/path)) per Decision D11.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Check: no-legacy-ai-config-references
//
// Keeps the Copilot → Claude Code migration at 100%. No tracked file may carry a
// pre-migration signal (a "Copilot" tool-name reference, an old
// .github/{prompts,skills,agents,instructions}/ path, an old
// .prompt.md/.agent.md/.instructions.md/.chatmode.md convention, an applyTo: /
// runSubagent( directive, or a parallel AI-tool dir .cursor/ .opencode/ .windsurf/).
//
// Implementation: shells out to scripts/audit-ai-config.mjs (git ls-files scan +
// allowlist) which writes tmp/ai-config-report.json. We surface each hit as an error.
// ---------------------------------------------------------------------------

interface AiConfigMatch {
  file: string;
  line: number;
  rule: string;
  kind: string;
  snippet: string;
}

interface AiConfigReport {
  generatedAt: string;
  totalFilesScanned: number;
  totalMatches: number;
  matches: AiConfigMatch[];
}

function checkNoLegacyAiConfigReferences(): void {
  if (!config.checks['no-legacy-ai-config-references']) return;

  const scriptPath = path.join(ROOT, 'scripts', 'audit-ai-config.mjs');
  if (!fs.existsSync(scriptPath)) {
    warnings.push(
      `[no-legacy-ai-config-references] scripts/audit-ai-config.mjs not found — skipping check.`,
    );
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawnSync } = require('child_process') as typeof import('child_process');
  const result = spawnSync(process.execPath, [scriptPath, '--quiet'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (result.error) {
    warnings.push(
      `[no-legacy-ai-config-references] failed to invoke audit script: ${result.error.message}`,
    );
    return;
  }

  const reportPath = path.join(ROOT, 'tmp', 'ai-config-report.json');
  if (!fs.existsSync(reportPath)) {
    warnings.push(`[no-legacy-ai-config-references] audit report missing: ${reportPath}`);
    return;
  }

  let report: AiConfigReport;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as AiConfigReport;
  } catch (err) {
    warnings.push(
      `[no-legacy-ai-config-references] failed to parse audit report: ${(err as Error).message}`,
    );
    return;
  }

  for (const m of report.matches) {
    const loc = m.line ? `${m.file}:${m.line}` : m.file;
    errors.push(
      `[no-legacy-ai-config-references] ${loc} — ${m.rule}. ` +
        `Migrate to the Claude Code layout (.claude/, CLAUDE.md). ` +
        `If intentional, allowlist it in scripts/audit-ai-config.mjs.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Check: figma-imported-icons-have-manifest-entry (ADR-006)
//
// Every icon symbol exported from packages/ui/src/icons/icons.tsx must trace
// to apps/webapp/src/app/design-preview/figma-library-manifest.json#icons[]
// (icon present in the imported Figma file) OR
// templateAllowlist[] (snapshot of icons that shipped with the template
// before any Figma import). Dormant unless the manifest exists AND
// iconsTraceabilityEnforced === true — projects that never adopt
// /figma-import keep zero overhead.
//
// Blocks agent-invented icons (e.g. ClockIcon added "because empty states
// often have clocks" when Figma has no clock anywhere).
// ---------------------------------------------------------------------------

function checkFigmaImportedIconsHaveManifestEntry(): void {
  if (!config.checks['figma-imported-icons-have-manifest-entry']) return;

  const manifestPath = path.join(
    ROOT,
    'apps/webapp/src/app/design-preview/figma-library-manifest.json',
  );
  if (!fs.existsSync(manifestPath)) return; // Dormant on projects without /figma-import.

  let manifest: {
    icons?: Array<{ name: string }>;
    templateAllowlist?: string[];
    iconsTraceabilityEnforced?: boolean;
  };
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    warnings.push(
      `[figma-imported-icons-have-manifest-entry] failed to parse manifest: ${(err as Error).message}`,
    );
    return;
  }

  if (!manifest.iconsTraceabilityEnforced) return; // Manifest exists but enforcement opted out.

  const iconsFile = path.join(ROOT, 'packages/ui/src/icons/icons.tsx');
  if (!fs.existsSync(iconsFile)) return;

  const allowed = new Set<string>([
    ...(manifest.icons ?? []).map((i) => i.name),
    ...(manifest.templateAllowlist ?? []),
  ]);

  const source = fs.readFileSync(iconsFile, 'utf-8');
  const exportRe = /export\s+function\s+(\w+Icon)\s*\(/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = exportRe.exec(source)) !== null) found.add(m[1]);

  for (const name of found) {
    if (allowed.has(name)) continue;
    errors.push(
      `[figma-imported-icons-have-manifest-entry] ${relative(iconsFile)}: icon '${name}' is not listed in figma-library-manifest.json#icons[] or templateAllowlist[]. ` +
        `If it came from the imported Figma file, add it to icons[] with the figmaNodeId. If it pre-dates the import, add it to templateAllowlist[]. ` +
        `Agent-invented icons are forbidden (Safety Guard #19, ADR-006, fe-icon-set skill § Provenance).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Check: cva-variants-have-storybook-argtypes (ADR-006)
//
// Every cva variant key declared in a primitive's .tsx must appear as an
// argTypes entry in the sibling .stories.tsx. Catches the failure mode
// where a primitive's variant is demoed via className ("variant-brand")
// instead of args:{ variant: 'brand' } — the Storybook Controls panel
// cannot toggle it, the Show Code panel surfaces a className blob, and
// the agent silently "completes" the stories file with a non-functional
// addon panel.
//
// CVA_ARGTYPES_BACKFILL_ALLOWLIST contains primitives whose cva variants
// live on a non-default subcomponent (e.g. Sheet → SheetContent.side) and
// where the stories file uses `render: () => <SubComponent side="..." />`
// instead of args. These pre-date ADR-006 and should be refactored to make
// the variant-bearing subcomponent the story component-of-record.
// New primitives MUST NOT be added here.
// ---------------------------------------------------------------------------

const CVA_ARGTYPES_BACKFILL_ALLOWLIST = new Set<string>([
  'feedback/sheet', // Sheet's `side` variant is on SheetContent; stories use hardcoded render JSX.
]);

function checkCvaVariantsHaveStorybookArgTypes(): void {
  if (!config.checks['cva-variants-have-storybook-argtypes']) return;

  const componentsRoot = path.join(ROOT, 'packages/ui/src/components');
  if (!fs.existsSync(componentsRoot)) return;

  for (const category of fs.readdirSync(componentsRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryDir = path.join(componentsRoot, category.name);

    for (const primitive of fs.readdirSync(categoryDir, { withFileTypes: true })) {
      if (!primitive.isDirectory()) continue;
      const primitiveDir = path.join(categoryDir, primitive.name);
      const name = primitive.name;

      const implFile = path.join(primitiveDir, `${name}.tsx`);
      const storiesFile = path.join(primitiveDir, `${name}.stories.tsx`);
      if (!fs.existsSync(implFile) || !fs.existsSync(storiesFile)) continue;

      const key = `${category.name}/${name}`;
      if (CVA_ARGTYPES_BACKFILL_ALLOWLIST.has(key)) continue;

      const impl = fs.readFileSync(implFile, 'utf-8');

      // Find cva(...) calls and extract their `variants: { ... }` block.
      // Match: `cva(` ... `variants: {` <captured block ending at the
      // closing `},`>. Tolerant of leading base-classes string and any
      // amount of whitespace / newlines.
      const cvaRe = /cva\s*\(\s*[^,]*,\s*\{[\s\S]*?variants\s*:\s*\{([\s\S]*?)\n\s*\}\s*,?/g;
      const variantKeys = new Set<string>();
      let cvaMatch: RegExpExecArray | null;
      while ((cvaMatch = cvaRe.exec(impl)) !== null) {
        const block = cvaMatch[1];
        // Top-level keys in the variants object — keys followed by `: {`.
        // We assume one key per line (standard formatting from cva docs +
        // the rest of this codebase).
        const keyRe = /^\s*(\w+)\s*:\s*\{/gm;
        let keyMatch: RegExpExecArray | null;
        while ((keyMatch = keyRe.exec(block)) !== null) variantKeys.add(keyMatch[1]);
      }

      if (variantKeys.size === 0) continue; // No cva variants → nothing to enforce.

      const stories = fs.readFileSync(storiesFile, 'utf-8');

      // Extract the argTypes block (or blocks — stories can have meta.argTypes
      // and per-story argTypes). We treat any argTypes object as eligible.
      const argTypesRe = /argTypes\s*:\s*\{([\s\S]*?)\n\s*\}/g;
      const declaredArgTypes = new Set<string>();
      let argMatch: RegExpExecArray | null;
      while ((argMatch = argTypesRe.exec(stories)) !== null) {
        const block = argMatch[1];
        const keyRe = /^\s*(\w+)\s*:\s*\{/gm;
        let keyMatch: RegExpExecArray | null;
        while ((keyMatch = keyRe.exec(block)) !== null) declaredArgTypes.add(keyMatch[1]);
      }

      for (const key of variantKeys) {
        if (declaredArgTypes.has(key)) continue;
        errors.push(
          `[cva-variants-have-storybook-argtypes] ${relative(storiesFile)}: cva variant key '${key}' from ${name}.tsx is missing from argTypes. ` +
            `The Storybook Controls addon panel cannot toggle it, and stories that set the variant via className will not surface in the Show Code panel. ` +
            `Add \`${key}: { control: 'select', options: [...] }\` to meta.argTypes and set non-default values via args: in named story exports. ` +
            `See ADR-006 and webapp-ui-primitive skill § Stories contract.`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check: agent-frontmatter-required
// Every .claude/agents/*.md must have YAML frontmatter with `name:` and
// `description:` AND a body section heading `## Allowed Tools`. Enforces the
// subagent contract documented in ADR-007.
// ---------------------------------------------------------------------------

function checkAgentFrontmatterRequired(): void {
  if (!config.checks['agent-frontmatter-required']) return;

  const agentsDir = path.join(ROOT, '.claude', 'agents');
  if (!fs.existsSync(agentsDir)) return;

  const files = fs
    .readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(agentsDir, f));

  for (const file of files) {
    const content = readFile(file);
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) {
      errors.push(`[agent-frontmatter-required] ${relative(file)}: Missing YAML frontmatter block (--- ... ---) at top of file.`);
      continue;
    }
    const frontmatter = fmMatch[1];
    if (!/^name\s*:/m.test(frontmatter)) {
      errors.push(`[agent-frontmatter-required] ${relative(file)}: YAML frontmatter must include a 'name:' field (the subagent_type used by the Agent tool).`);
    }
    if (!/^description\s*:/m.test(frontmatter)) {
      errors.push(`[agent-frontmatter-required] ${relative(file)}: YAML frontmatter must include a 'description:' field (used as discovery surface for the Agent tool).`);
    }
    if (!/^##\s+Allowed Tools\s*$/m.test(content)) {
      errors.push(`[agent-frontmatter-required] ${relative(file)}: Body must contain a '## Allowed Tools' section heading (enforcement contract per ADR-007).`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check: runSubagent-reference-resolves
// Every `Agent(subagent_type="X", ...)` call inside .claude/commands/**/*.md
// must resolve to an existing .claude/agents/X.md. Prevents drift between
// orchestrator commands and the subagent catalog (ADR-007).
// ---------------------------------------------------------------------------

function checkRunSubagentReferenceResolves(): void {
  if (!config.checks['runSubagent-reference-resolves']) return;

  const commandsDir = path.join(ROOT, '.claude', 'commands');
  const agentsDir = path.join(ROOT, '.claude', 'agents');
  if (!fs.existsSync(commandsDir) || !fs.existsSync(agentsDir)) return;

  const existingAgents = new Set(
    fs
      .readdirSync(agentsDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, '')),
  );

  const commandFiles = fs
    .readdirSync(commandsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(commandsDir, f));

  // Match: Agent(subagent_type="X", ...) or Agent(subagent_type='X', ...) — quotes can be either
  const refPattern = /Agent\s*\(\s*subagent_type\s*=\s*["']([^"']+)["']/g;

  for (const file of commandFiles) {
    const content = readFile(file);
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = refPattern.exec(content)) !== null) {
      const agentName = match[1];
      if (seen.has(agentName)) continue;
      seen.add(agentName);
      if (!existingAgents.has(agentName)) {
        errors.push(
          `[runSubagent-reference-resolves] ${relative(file)}: References subagent "${agentName}" but .claude/agents/${agentName}.md does not exist.`,
        );
      }
    }
  }
}

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
checkServiceConfigCompleteness();
checkDomainExceptionFilterExists();
checkBarrelExportCompleteness();
checkEventHandlerServiceExists();
checkAppServiceHasLogger();
checkNoUserIdInControllerInput();
checkGatewayPublicRoutesSync();
checkNoScssFiles();
checkNoDynamicTailwindClasses();
checkUiPrimitiveHasStoryAndSpec();
checkSkillsNoExampleImports();
checkNoWorkspaceProtocolInLambdaPackageJson();
checkSwaggerDecoratorsRequired();
checkFigmaImportedIconsHaveManifestEntry();
checkCvaVariantsHaveStorybookArgTypes();
checkAgentFrontmatterRequired();
checkRunSubagentReferenceResolves();
checkNoLegacyAiConfigReferences();

// Print results
if (warnings.length > 0) {
  console.log('⚠️  Warnings:');
  warnings.forEach((w) => console.log(`  ${w}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ Coding standard violations:');
  errors.forEach((e) => console.log(`  ${e}`));
  console.log(`\n${errors.length} violation(s) found. Fix them before merging.`);
  process.exit(1);
} else {
  console.log(`✅ All coding standards checks passed (${Object.values(config.checks).filter(Boolean).length} checks enabled).`);
  process.exit(0);
}
