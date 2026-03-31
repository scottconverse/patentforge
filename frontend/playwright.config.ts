import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'cd ../backend && node --env-file=.env dist/main',
      port: 3000,
      timeout: 15_000,
      reuseExistingServer: true,
    },
    {
      command: 'cd ../services/feasibility && node dist/server.js',
      port: 3001,
      timeout: 15_000,
      reuseExistingServer: true,
    },
    {
      command: 'npx vite --port 8080 --strictPort',
      port: 8080,
      timeout: 15_000,
      reuseExistingServer: true,
    },
  ],
});
