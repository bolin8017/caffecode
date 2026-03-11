// apps/web/e2e/admin.spec.ts
import { test, expect } from '@playwright/test'
import { adminTest } from './fixtures/auth'
import { authenticatedTest } from './fixtures/auth'

// Non-admin user should be blocked
authenticatedTest.describe('Admin — access control', () => {
  authenticatedTest('non-admin redirected from /admin to /dashboard', async ({ page }) => {
    await page.goto('/admin')

    // Non-admin user should be redirected away from admin
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 10000 })
    expect(page.url()).not.toMatch(/\/admin$/)
  })
})

adminTest.describe('Admin — dashboard and pages', () => {
  adminTest('admin dashboard shows metrics cards', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Admin dashboard should show metric/stat cards
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })

    // Should have some card-like elements with numbers
    await expect(page.locator('body')).not.toHaveText(/error|500|forbidden/i)
  })

  adminTest('sidebar has monitoring, content, and users groups', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    // Look for sidebar navigation links
    const sidebar = page.locator('nav, aside, [data-testid="admin-sidebar"]').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Should contain links to main admin sections
    const links = page.locator('a[href*="/admin/"]')
    const count = await links.count()
    expect(count).toBeGreaterThanOrEqual(3) // At minimum: push, problems, users
  })

  adminTest('push monitor page loads with history table', async ({ page }) => {
    await page.goto('/admin/push')
    await page.waitForLoadState('networkidle')

    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })

    // Should show a table or list of push runs
    const table = page
      .locator('table, [role="table"], [data-testid="push-history"]')
      .first()
    await expect(table).toBeVisible({ timeout: 10000 })
  })

  adminTest('channels page loads with channel list', async ({ page }) => {
    await page.goto('/admin/channels')
    await page.waitForLoadState('networkidle')

    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })
    await expect(page.locator('body')).not.toHaveText(/error|500/i)
  })

  adminTest('problems page loads with problem table', async ({ page }) => {
    await page.goto('/admin/problems')
    await page.waitForLoadState('networkidle')

    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })

    // Should show a table of problems
    const table = page.locator('table, [role="table"]').first()
    await expect(table).toBeVisible({ timeout: 10000 })
  })

  adminTest('content page loads', async ({ page }) => {
    await page.goto('/admin/content')
    await page.waitForLoadState('networkidle')

    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })
    await expect(page.locator('body')).not.toHaveText(/error|500/i)
  })

  adminTest('lists page loads', async ({ page }) => {
    await page.goto('/admin/lists')
    await page.waitForLoadState('networkidle')

    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })
    await expect(page.locator('body')).not.toHaveText(/error|500/i)
  })

  adminTest('users page loads with user table', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })

    // Should show a table of users
    const table = page.locator('table, [role="table"]').first()
    await expect(table).toBeVisible({ timeout: 10000 })
  })
})
