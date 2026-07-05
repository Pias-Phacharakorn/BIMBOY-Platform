import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// ─── Load .env / .env.local ───────────────────────────────────────────────────
// The project keeps secrets (Supabase keys, test-account credentials) in
// .env* files. Reuse Vite's loader (Vite is already a dependency) — the ''
// prefix loads all keys, not just VITE_*. Existing process.env values win.
const rootDir = dirname(fileURLToPath(import.meta.url))
process.env = { ...loadEnv('development', rootDir, ''), ...process.env }

const PORT = 5173
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Fail the build on CI if you accidentally left test.only in the source.
  forbidOnly: !!process.env.CI,
  // Retry once on CI to smooth over occasional flakiness.
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL,
    // Capture a trace when a test is retried — helps debug failures.
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the Vite dev server automatically before tests, and reuse it if one
  // is already running locally.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
