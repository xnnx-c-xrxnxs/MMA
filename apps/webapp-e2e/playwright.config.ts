import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const STORAGE_STATE = path.join(__dirname, '.auth/user.json');

/**
 * Playwright E2E Configuration for the webapp.
 *
 * Uses a setup project to authenticate via the login page before running tests.
 * All "authenticated" tests share the stored browser state (cookies + localStorage).
 * The "unauthenticated" project runs auth page tests without stored state.
 *
 * Assumes all backend services and the webapp are already running.
 * Use the VS Code tasks or `pnpm run` scripts to start infrastructure first.
 */
export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  outputDir: '../../test-results/webapp-e2e/',

  projects: [
    // 1. Setup: authenticate and save browser state
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // 2. Auth page tests: run WITHOUT stored state (test login/redirect flows)
    {
      name: 'auth-tests',
      testDir: './src/specs/auth',
      use: { ...devices['Desktop Chrome'] },
    },
    // 3. Authenticated tests: run WITH stored state (all domain pages)
    {
      name: 'chromium',
      testDir: './src/specs',
      testIgnore: [/specs\/auth\//, /specs\/visual\//],
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
    // 4. Visual / public-route tests: NO auth, NO storage state.
    //    For routes like /design-preview that are publicly accessible.
    //    Keeps the visual baseline independent of auth-api availability.
    {
      name: 'visual',
      testDir: './src/specs/visual',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
