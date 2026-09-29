import { defineConfig, devices } from '@playwright/test';
import { e2eCredentials, loadTestEnv } from '../api/test/test-env.cjs';

loadTestEnv();
e2eCredentials();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Run `npm run build` first. Refuse occupied ports to avoid testing another DB.
  webServer: [
    {
      command: 'npm run start --workspace=@campus-crew/api',
      url: 'http://127.0.0.1:4000/api/recruitments',
      env: { PORT: '4000', NODE_ENV: 'test' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run start --workspace=@campus-crew/web',
      url: 'http://127.0.0.1:3000/login',
      env: { NODE_ENV: 'production' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
