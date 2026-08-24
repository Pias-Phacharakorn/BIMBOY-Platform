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

// ─── A dedicated port, deliberately not Vite's 5173 ───────────────────────────
// `vite.config.ts` sets no `server.port`, so `npm run dev` takes 5173 and silently increments
// when it is busy — a second branch's server lands on 5174, a third on 5175. Combined with
// `reuseExistingServer` below, pointing this at 5173 meant `npm run test:e2e` could attach to
// whatever server happened to be sitting there, including a stale one built from other code, and
// report green against it. Nothing else listens on 5199, so the suite always starts its own
// server from the current working tree.
const PORT = 5199
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
      // `channel: 'chrome'` runs the Chrome already installed on this machine instead of
      // Playwright's own pinned build, which was never downloaded here (`browserType.launch:
      // Executable doesn't exist at ...chrome-headless-shell`). Two reasons beyond avoiding a
      // ~400 MB download: specs run in the same engine the developer tests in, so a Chrome-specific
      // WebGL or OBC quirk found live is reproducible by a spec; and there is one browser to reason
      // about rather than two.
      // ⚠️ CI has no Chrome. Running there needs either `npx playwright install chromium` plus
      // dropping this line, or a Chrome setup step.
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  // Start the Vite dev server automatically before tests, and reuse it if one
  // is already running locally.
  webServer: {
    // `--port` must be passed explicitly: `npm run dev` is a bare `vite`, which would bind 5173
    // and leave this suite waiting on 5199 until it timed out. `--strictPort` makes a collision
    // fail loudly instead of drifting to the next free port and stranding us again.
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
