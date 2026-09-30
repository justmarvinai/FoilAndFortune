import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Claude Code cloud sessions ship a pre-installed Chromium; CI installs its own via
// `npx playwright install`. SwiftShader flags let WebGL run headless.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PW_CHROMIUM_PATH ?? (existsSync(preinstalled) ? preinstalled : undefined);
const launchOptions = {
  executablePath,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  // Locally, one browser at a time: software WebGL (SwiftShader) on a few shared cores can
  // starve the machine. CI runners get Playwright's default parallelism.
  workers: process.env.CI ? undefined : 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions },
    },
    {
      name: 'phone-landscape',
      use: { ...devices['Pixel 7 landscape'], launchOptions },
    },
  ],
});
