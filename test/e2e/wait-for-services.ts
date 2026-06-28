/**
 * Service Health Check Utility
 *
 * Waits for all backend services (and optionally the webapp) to respond
 * before E2E tests start. Retries with exponential backoff.
 *
 * Services are read dynamically from .github/service-registry.json so this
 * file never needs editing when domains are added or removed.
 */

import http from 'http';
import * as path from 'path';
import * as fs from 'fs';

interface ServiceCheck {
  name: string;
  url: string;
}

function buildBackendServices(): ServiceCheck[] {
  const registryPath = path.resolve(process.cwd(), '.github/service-registry.json');
  if (!fs.existsSync(registryPath)) {
    console.warn('Warning: .github/service-registry.json not found — no services to wait for');
    return [];
  }
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  return (registry.apiServices ?? []).map(
    (s: { name: string; domain: string }) => {
      const portEnvVar = `${s.domain.toUpperCase()}_SERVICE_PORT`;
      const port = process.env[portEnvVar] ?? '3000';
      return {
        name: s.name,
        url: `http://localhost:${port}/api/swagger`,
      };
    },
  );
}

const BACKEND_SERVICES: ServiceCheck[] = buildBackendServices();

const WEBAPP_SERVICE: ServiceCheck = {
  name: 'webapp',
  url: `http://localhost:4200`,
};

function checkUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      // Any response (including redirects) means the service is up
      resolve(res.statusCode !== undefined && res.statusCode < 500);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForService(
  service: ServiceCheck,
  maxAttempts = 30,
  baseDelayMs = 1000,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ok = await checkUrl(service.url);
    if (ok) {
      console.log(`  ✓ ${service.name} is ready`);
      return;
    }
    const delay = Math.min(baseDelayMs * attempt, 5000);
    if (attempt < maxAttempts) {
      process.stdout.write(`  ⏳ ${service.name} not ready (attempt ${attempt}/${maxAttempts})\r`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`${service.name} did not become ready after ${maxAttempts} attempts at ${service.url}`);
}

export async function waitForBackendServices(): Promise<void> {
  console.log('Waiting for backend services...');
  for (const service of BACKEND_SERVICES) {
    await waitForService(service);
  }
  console.log('All backend services ready.\n');
}

export async function waitForWebapp(): Promise<void> {
  console.log('Waiting for webapp...');
  await waitForService(WEBAPP_SERVICE);
  console.log('Webapp ready.\n');
}

export async function waitForAllServices(): Promise<void> {
  await waitForBackendServices();
  await waitForWebapp();
}

// Allow running directly: ts-node test/e2e/wait-for-services.ts [--all]
if (require.main === module) {
  const includeWebapp = process.argv.includes('--all');
  const run = includeWebapp ? waitForAllServices : waitForBackendServices;
  run().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
