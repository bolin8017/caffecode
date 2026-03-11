import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    // Use en-US locale; the app serves zh-TW content regardless
    locale: 'en-US',
  },
  // Load .env.local so global-setup has access to SUPABASE_SERVICE_ROLE_KEY
  envFile: '.env.local',
  projects: [
    // Setup project — creates test users and saves auth state
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
      teardown: undefined,
    },
    // Public pages — no auth needed
    {
      name: 'public',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /public-pages.*\.spec\.ts/,
    },
    // Authenticated user tests
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /(dashboard|settings|garden)\.spec\.ts/,
    },
    // Admin tests
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: /admin\.spec\.ts/,
    },
    // Fresh user tests (onboarding)
    {
      name: 'fresh-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/fresh.json',
      },
      dependencies: ['setup'],
      testMatch: /onboarding\.spec\.ts/,
    },
    // Auth flow tests — no pre-existing auth
    {
      name: 'auth-flow',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth-flow\.spec\.ts/,
    },
  ],
  globalSetup: './e2e/global-setup.ts',
  // Do not start a local dev server — tests run against a running instance
  // Start server with: pnpm dev (in apps/web/)
})
