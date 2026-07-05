import { test, expect } from '@playwright/test'

// Regression test for the viewport dispose crash: opening the model view mounts
// the full OBC engine, and leaving it (e.g. clicking the sidebar logo) used to
// throw during Components.dispose() — "No camera initialized!" from
// SpotCoordinate, and a "Cannot read properties of null (reading 'dispose')"
// variant with a model loaded — which React's error boundary turned into a full
// app teardown. This test drives that flow and asserts teardown is clean.
test('leaving the model view does not crash on dispose', async ({ page }) => {
  const email = process.env.VITE_DEV_AUTO_LOGIN_EMAIL
  const password = process.env.VITE_DEV_AUTO_LOGIN_PASSWORD
  test.skip(!email || !password, 'Set VITE_DEV_AUTO_LOGIN_* in .env.local to run.')

  // Collect only teardown-crash signatures — ignore unrelated errors like
  // model file fetch failures that depend on storage/network.
  const teardownErrors: string[] = []
  const isTeardownCrash = (msg: string) =>
    /No camera initialized/i.test(msg) ||
    /reading 'dispose'/i.test(msg) ||
    /dispose error on unmount/i.test(msg)
  page.on('pageerror', (e) => {
    if (isTeardownCrash(e.message)) teardownErrors.push(`pageerror: ${e.message}`)
  })
  page.on('console', (m) => {
    if (m.type() === 'error' && isTeardownCrash(m.text()))
      teardownErrors.push(`console: ${m.text()}`)
  })

  // Log in.
  await page.goto('/login')
  await page.getByLabel('Email Address').fill(email!)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(/\/projects/, { timeout: 15_000 })

  // Find a project to open the model view for.
  await page.waitForTimeout(2000)
  const projectId = await page.evaluate(() => {
    const href = Array.from(document.querySelectorAll('a[href*="/projects/"]'))
      .map((el) => el.getAttribute('href') || '')
      .map((h) => h.match(/\/projects\/([^/]+)/)?.[1])
      .find(Boolean)
    return href || null
  })
  test.skip(!projectId, 'No project available in the test account to open a model view.')

  // Open the model view (mounts the engine), then leave it (unmount -> dispose).
  await page.goto(`/projects/${projectId}/model`)
  await page.waitForTimeout(6000) // let setupComponents() finish
  await page.goto('/projects')
  await page.waitForTimeout(3000) // let teardown run

  expect(teardownErrors, `teardown crash(es):\n${teardownErrors.join('\n')}`).toEqual([])
})
