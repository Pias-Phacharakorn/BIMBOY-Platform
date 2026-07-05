import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

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
// Uses the dev/test account credentials from .env.local. loginAsTestUser fills
// the form, submits, and waits for the redirect to /projects.
test('user can log in', async ({ page }) => {
  await loginAsTestUser(page)
  await expect(page).toHaveURL(/\/projects/)
})
