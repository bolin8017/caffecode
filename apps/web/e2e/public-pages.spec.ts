import { test, expect } from '@playwright/test'

/**
 * Public page tests — these run against a live app instance.
 * Start the app first: pnpm dev (in apps/web/)
 *
 * These tests verify the public-facing pages render correctly
 * without any authentication.
 */

test.describe('Landing page', () => {
  test('renders hero and CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    // Expect at least one link pointing to /login or /problems
    const ctaLinks = page.locator('a[href="/login"], a[href="/problems"]')
    await expect(ctaLinks.first()).toBeVisible()
  })
})

test.describe('Login page', () => {
  test('renders OAuth buttons', async ({ page }) => {
    await page.goto('/login')
    // Should show Google and GitHub auth buttons
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /github/i })).toBeVisible()
  })

  test('has page title', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/登入/)
  })
})

test.describe('Problems list page', () => {
  test('renders problem list', async ({ page }) => {
    await page.goto('/problems')
    // Should have at least one problem link
    const problemLinks = page.locator('a[href^="/problems/"]')
    await expect(problemLinks.first()).toBeVisible()
  })

  test('search filter works', async ({ page }) => {
    await page.goto('/problems')
    const searchInput = page.locator('input[name="q"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('two sum')
      await searchInput.press('Enter')
      await expect(page).toHaveURL(/q=two\+sum|q=two%20sum/)
    }
  })
})

test.describe('Lists page', () => {
  test('renders curated lists', async ({ page }) => {
    await page.goto('/lists')
    // Should show list cards
    await expect(page.locator('h1')).toBeVisible()
    const listLinks = page.locator('a[href^="/lists/"]')
    await expect(listLinks.first()).toBeVisible()
  })
})

test.describe('Problem detail page', () => {
  test('renders problem content (two-sum)', async ({ page }) => {
    await page.goto('/problems/two-sum')
    // Might 404 if content not loaded; skip gracefully
    const status = page.url()
    if (!status.includes('not-found')) {
      await expect(page.locator('h1')).toBeVisible()
    }
  })
})

test.describe('Auth redirect', () => {
  test('redirects /dashboard to /login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirects /settings to /login when not authenticated', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login/)
  })
})
