import { test, expect } from '@playwright/test'

// ─── Test 1: the login page loads ─────────────────────────────────────────────
// No credentials needed. Visiting the app root redirects an unauthenticated
// visitor: / → /projects → /login. We confirm we land on /login and that the
// key parts of the login form are visible.
test('login page loads', async ({ page }) => {
  await page.goto('/')

  // The root and /projects both redirect an anonymous user to /login.
  await expect(page).toHaveURL(/\/login/)

  // Brand heading, the submit button, and both credential fields are present.
  await expect(page.getByRole('heading', { name: 'BIM BOY' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await expect(page.getByLabel('Email Address')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
})

// ─── Test 2: a user can log in ────────────────────────────────────────────────
// Uses the dev/test account credentials from .env.local. Fills the form, submits,
// and expects a successful redirect to /projects.
test('user can log in', async ({ page }) => {
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

  // On success the app navigates to the projects list.
  await expect(page).toHaveURL(/\/projects/, { timeout: 15_000 })
})
