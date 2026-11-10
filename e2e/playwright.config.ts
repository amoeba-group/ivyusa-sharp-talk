import { defineConfig, devices } from '@playwright/test';

/**
 * IVY USA TalkTalk widget — E2E suite.
 * Test cases are specified in ivy-docs/TEST-CASES.md; each test title starts with its TC id
 * and carries tags: @T<nn> (task in ivy-docs/TASKS.md), @smoke, @design (Figma parity), @i18n.
 *
 * Targets (E2E_TARGET):
 *   local (default) — widget dev server :5174 + API :3000 (`npm run dev` at repo root)
 *   prod            — https://talk.ivyusa.com (smoke only; the ELB allowlists source IPs)
 */
const target = process.env.E2E_TARGET ?? 'local';

const TARGETS = {
  local: {
    widgetUrl: process.env.E2E_WIDGET_URL ?? 'http://localhost:5174/',
    apiUrl: process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1',
  },
  prod: {
    widgetUrl: process.env.E2E_WIDGET_URL ?? 'https://talk.ivyusa.com/widget/',
    apiUrl: process.env.E2E_API_URL ?? 'https://talk.ivyusa.com/api/v1',
  },
} as const;

const t = TARGETS[target as keyof typeof TARGETS] ?? TARGETS.local;
process.env.E2E_RESOLVED_WIDGET_URL = t.widgetUrl;
process.env.E2E_RESOLVED_API_URL = t.apiUrl;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  outputDir: './test-results',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  // The widget keeps per-session state server-side; a couple of workers is plenty locally.
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  // In GitHub Actions, failures also surface as annotations on the commit / PR.
  reporter: process.env.GITHUB_ACTIONS
    ? [['github'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: t.widgetUrl,
    locale: 'en-US',
    // IVY USA operates on US Eastern time — relative/absolute notification times are asserted in it.
    timezoneId: 'America/New_York',
    // A missing element must fail fast instead of eating the whole test timeout.
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects:
    target === 'prod'
      ? [
          // Production: read-only smoke cases only (TC-16-*), desktop only.
          { name: 'prod', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }, grep: /@prod/ },
        ]
      : [
          {
            name: 'desktop',
            use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
            grepInvert: /@mobile-only|@prod/,
          },
          {
            name: 'mobile',
            use: { ...devices['Pixel 7'] },
            // Only layout/responsive cases run on mobile; everything else is viewport-agnostic.
            grep: /@responsive|@mobile-only/,
            grepInvert: /@prod/,
          },
        ],
});
