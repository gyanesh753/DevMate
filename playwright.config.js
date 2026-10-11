import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'
config({ path: '.env.test', quiet: true })
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node server/index.js',
      url: 'http://127.0.0.1:5100/api/health',
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ALLOWED_ORIGINS: 'http://127.0.0.1:5174',
        PORT: '5100',
      },
    },
    {
      command: 'npm run dev -w client -- --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_API_URL: 'http://127.0.0.1:5100',
        VITE_SUPABASE_URL: process.env.SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
      },
    },
  ],
})
