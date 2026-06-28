/**
 * Local E2E Runner (Hybrid)
 *
 * Automates the full local E2E workflow — only does what's needed:
 *   1. Ensures .env.e2e exists
 *   2. Starts Docker if containers aren't running
 *   3. Runs E2E infrastructure setup (idempotent)
 *   4. Builds backend services (skips if dist/ is fresh)
 *   5. Starts services that aren't already listening
 *   6. Waits for all services to be healthy
 *   7. Runs the E2E test suite
 *   8. Cleans up background processes on exit
 *
 * Usage:
 *   pnpm e2e:local                  # API E2E tests only
 *   pnpm e2e:local -- --webapp      # Include webapp E2E tests
 *   pnpm e2e:local -- --skip-build  # Skip NX build step
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';

// ─── Configuration ───────────────────────────────────────────────────────────

const ROOT_DIR = path.resolve(__dirname, '..');

const SERVICES = [
  { name: 'auth-api-service', port: 3003, project: 'auth-api-service' },
  { name: 'file-api-service', port: 3004, project: 'file-api-service' },
];

const DOCKER_CONTAINERS = ['localstack_old_st', 'postgres_old_st'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(`\n🔧 ${msg}`);
}

function logStep(msg: string): void {
  console.log(`  → ${msg}`);
}

function run(cmd: string, opts?: { cwd?: string; env?: NodeJS.ProcessEnv }): void {
  execSync(cmd, {
    cwd: opts?.cwd ?? ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...opts?.env },
  });
}

function runQuiet(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

function isContainerRunning(name: string): boolean {
  const result = runQuiet(`docker inspect -f "{{.State.Running}}" ${name}`);
  return result === 'true';
}

function loadEnvFile(envFile: string): void {
  const envFilePath = path.resolve(ROOT_DIR, envFile);
  if (!fs.existsSync(envFilePath)) {
    return;
  }
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) {
      process.env[key] = value;
    }
  }
}

// ─── Steps ───────────────────────────────────────────────────────────────────

function ensureEnvFile(): void {
  log('Step 1: Checking .env.e2e');
  const envPath = path.resolve(ROOT_DIR, '.env.e2e');
  const examplePath = path.resolve(ROOT_DIR, '.env.e2e.example');

  if (fs.existsSync(envPath)) {
    logStep('.env.e2e exists — loading');
    loadEnvFile('.env.e2e');
    return;
  }

  if (fs.existsSync(examplePath)) {
    logStep('.env.e2e not found — copying from .env.e2e.example');
    fs.copyFileSync(examplePath, envPath);
    loadEnvFile('.env.e2e');
    return;
  }

  console.error('❌ Neither .env.e2e nor .env.e2e.example found. Cannot proceed.');
  process.exit(1);
}

function ensureDocker(): void {
  log('Step 2: Checking Docker containers');

  const allRunning = DOCKER_CONTAINERS.every((c) => isContainerRunning(c));
  if (allRunning) {
    logStep('Docker containers already running — skipping');
    return;
  }

  logStep('Starting Docker containers...');
  run('docker compose up -d');

  // Wait for containers to be healthy (up to 30s)
  const maxWait = 30;
  for (let i = 0; i < maxWait; i++) {
    const ready = DOCKER_CONTAINERS.every((c) => isContainerRunning(c));
    if (ready) {
      logStep('Docker containers are running');
      return;
    }
    execSync('ping -n 2 127.0.0.1 > nul', { stdio: 'ignore' }); // ~1s delay (Windows)
  }

  console.error('❌ Docker containers did not start in time.');
  process.exit(1);
}

function setupE2eInfra(): void {
  log('Step 3: Setting up E2E infrastructure (tables, queues, DB)');
  run('pnpm run e2e:setup');
}

function buildServices(skipBuild: boolean): void {
  log('Step 4: Building backend services');

  if (skipBuild) {
    logStep('--skip-build flag set — skipping');
    return;
  }

  const projects = SERVICES.map((s) => s.project).join(',');
  logStep(`Building ${projects}...`);
  run(`npx nx run-many --target=build --projects=${projects} --parallel=3`, {
    env: { NX_TUI: 'false', NX_DAEMON: 'false', NX_PLUGIN_NO_TIMEOUTS: 'true' },
  });
}

function spawnService(
  name: string,
  args: string[],
  logName: string,
  spawned: ChildProcess[]
): void {
  const child = spawn('npx', args, {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    shell: true,
    env: {
      ...process.env,
      NX_TUI: 'false',
      NX_DAEMON: 'false',
      NX_PLUGIN_NO_TIMEOUTS: 'true',
    },
  });

  // Capture output for debugging startup failures
  const logFile = path.join(ROOT_DIR, 'tmp', `serve-${logName}.log`);
  const logStream = fs.createWriteStream(logFile);
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);

  child.on('error', (err) => {
    console.error(`  ⚠ ${name} spawn error: ${err.message}`);
  });

  spawned.push(child);
}

function killPortProcess(port: number): void {
  try {
    // Windows: find PID using the port and kill it
    const result = runQuiet(`netstat -ano | findstr ":${port} "`);
    const lines = result.split('\n').filter((l) => l.includes('LISTENING'));
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        } catch {
          // Ignore if already gone
        }
      }
    }
  } catch {
    // Ignore errors — process may not be running
  }
}

async function startServices(includeWebapp: boolean): Promise<ChildProcess[]> {
  log('Step 5: Starting backend services (restarting any already-running instances to apply E2E env)');
  const spawned: ChildProcess[] = [];

  for (const svc of SERVICES) {
    const open = await isPortOpen(svc.port);
    if (open) {
      logStep(`${svc.name} running on port ${svc.port} — killing to restart with E2E env...`);
      killPortProcess(svc.port);
      // Brief pause to let the port release
      await new Promise((r) => setTimeout(r, 500));
    }

    logStep(`Starting ${svc.name} on port ${svc.port}...`);
    spawnService(svc.name, ['nx', 'serve', svc.project], svc.project, spawned);
  }

  if (includeWebapp) {
    const webappPort = 4200;
    const open = await isPortOpen(webappPort);
    if (open) {
      logStep(`webapp already listening on port ${webappPort} — skipping`);
    } else {
      logStep(`Starting webapp on port ${webappPort}...`);
      spawnService('webapp', ['nx', 'dev', 'webapp'], 'webapp', spawned);
    }
  }

  return spawned;
}

async function waitForServices(includeWebapp: boolean): Promise<void> {
  log('Step 6: Waiting for services to be healthy');

  const checks = SERVICES.map((s) => ({
    name: s.name,
    url: `http://localhost:${s.port}/api/swagger`,
    port: s.port,
  }));

  if (includeWebapp) {
    checks.push({ name: 'webapp', url: 'http://localhost:4200', port: 4200 });
  }

  const maxAttempts = 60; // More generous for local builds
  const baseDelay = 2000;

  for (const check of checks) {
    let ready = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const open = await isPortOpen(check.port);
      if (open) {
        logStep(`✓ ${check.name} is ready on port ${check.port}`);
        ready = true;
        break;
      }
      if (attempt % 10 === 0) {
        logStep(`⏳ ${check.name} not ready yet (attempt ${attempt}/${maxAttempts})...`);
      }
      await new Promise((r) => setTimeout(r, Math.min(baseDelay, 5000)));
    }
    if (!ready) {
      throw new Error(`${check.name} did not start within ${maxAttempts} attempts on port ${check.port}`);
    }
  }

  logStep('All services healthy');
}

function runTests(includeWebapp: boolean): void {
  log('Step 7: Running E2E tests');

  const nxEnv = { NX_TUI: 'false', NX_DAEMON: 'false', NX_PLUGIN_NO_TIMEOUTS: 'true' };

  logStep('Running API E2E tests...');
  run('pnpm run test:e2e:api', { env: nxEnv });

  if (includeWebapp) {
    logStep('Running Webapp E2E tests...');
    run('pnpm run test:e2e:webapp', { env: nxEnv });
  }
}

function cleanup(processes: ChildProcess[]): void {
  if (processes.length === 0) return;

  log('Cleaning up background service processes');
  for (const child of processes) {
    try {
      if (child.pid) {
        // On Windows, use taskkill to kill the process tree
        try {
          execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
        } catch {
          child.kill('SIGTERM');
        }
      }
    } catch {
      // Process may have already exited
    }
  }
  logStep('Processes cleaned up');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const includeWebapp = args.includes('--webapp');
  const skipBuild = args.includes('--skip-build');

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Local E2E Runner (Hybrid)');
  console.log('═══════════════════════════════════════════════════════');
  if (includeWebapp) console.log('  Mode: API + Webapp E2E');
  else console.log('  Mode: API E2E only (use --webapp for full suite)');
  if (skipBuild) console.log('  Build: skipped (--skip-build)');
  console.log('');

  let spawnedProcesses: ChildProcess[] = [];

  // Register cleanup handler
  const doCleanup = () => cleanup(spawnedProcesses);
  process.on('SIGINT', () => { doCleanup(); process.exit(130); });
  process.on('SIGTERM', () => { doCleanup(); process.exit(143); });

  try {
    // 1. Env file
    ensureEnvFile();

    // 2. Docker
    ensureDocker();

    // 3. E2E infra (tables, queues, DB)
    setupE2eInfra();

    // 4. Build services
    buildServices(skipBuild);

    // 5. Start services that aren't already running
    spawnedProcesses = await startServices(includeWebapp);

    // 6. Wait for health
    await waitForServices(includeWebapp);

    // 7. Run tests
    runTests(includeWebapp);

    console.log('\n✅ E2E tests completed successfully!\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ E2E run failed: ${msg}\n`);
    process.exitCode = 1;
  } finally {
    doCleanup();
  }
}

main();
