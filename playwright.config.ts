import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lightweight loader for a gitignored .env.e2e (no dotenv dependency). Lets you
// supply SUPABASE_SERVICE_ROLE_KEY / E2E_ADMIN_PASSWORD / E2E_VERIFY_TOKEN etc.
// without exporting them inline. Existing process.env wins.
const envFile = path.join(__dirname, '.env.e2e');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/**
 * Kitchen Directory — Playwright E2E config.
 *
 * Target: the live production deployment by default (public prod alias — Vercel
 * preview deploys are SSO-gated, so headless QA must hit the public alias).
 * Override with BASE_URL to point at a preview/local build.
 *
 * Optional local run:  BASE_URL=http://localhost:4321 npx playwright test
 * (requires a local `.env` with real Supabase creds — see e2e/README.md).
 */
const BASE_URL = process.env.BASE_URL || 'https://kitchen-directory.vercel.app';

export const ADMIN_STORAGE_STATE = path.join(__dirname, 'e2e/.auth/admin.json');

export default defineConfig({
  testDir: './e2e',
  // Forms create real rows; run files in parallel but tests within a file serially
  // where ordering matters (declared per-file). Cap workers so we never hammer prod.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : 6,
  reporter: [['html', { open: 'never' }], ['list']],

  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    // Prod is network-dependent; capture evidence on failure only.
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Identify our traffic in server logs and skip any "are you a bot" heuristics.
    userAgent: 'KitchenDirectory-E2E Playwright (+qa)',
    extraHTTPHeaders: { 'X-E2E-Test': '1' },
  },

  projects: [
    // 1. Mint an authenticated admin session (writes e2e/.auth/admin.json).
    //    No-op-safe: if creds are absent it writes an empty state and admin
    //    flows skip themselves at runtime.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // 2. All public, form, SEO, a11y, responsive and unauthenticated-admin specs.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testIgnore: [/auth\.setup\.ts/, /admin\/authenticated\//],
    },

    // 3. Authenticated admin flows — reuse the stored session.
    {
      name: 'admin',
      testMatch: /admin\/authenticated\//,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: ADMIN_STORAGE_STATE,
      },
    },
  ],
});
