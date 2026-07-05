import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// ─── Load .env.local ──────────────────────────────────────────────────────────
// The project keeps secrets (Supabase keys, test-account credentials) in
// .env.local. We read it manually here so tests can use those values without
// adding a `dotenv` dependency. Existing process.env values always win.
const rootDir = dirname(fileURLToPath(import.meta.url))
try {
  const envFile = readFileSync(resolve(rootDir, '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
} catch {
  // .env.local is optional — the credential-free smoke test still runs without it.
}

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
