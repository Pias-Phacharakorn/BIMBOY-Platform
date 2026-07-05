import { test, type Page } from '@playwright/test'

/**
 * Log in as the dev/test account (credentials from .env.local). Skips the
 * calling test if credentials aren't configured. Resolves once the app has
 * navigated to /projects.
 */
export async function loginAsTestUser(page: Page) {
  const email = process.env.VITE_DEV_AUTO_LOGIN_EMAIL
  const password = process.env.VITE_DEV_AUTO_LOGIN_PASSWORD
  test.skip(
    !email || !password,
    'Set VITE_DEV_AUTO_LOGIN_EMAIL / VITE_DEV_AUTO_LOGIN_PASSWORD in .env.local to run this test.',
  )

  await page.goto('/login')
  await page.getByLabel('Email Address').fill(email!)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(/\/projects/, { timeout: 15_000 })
}
