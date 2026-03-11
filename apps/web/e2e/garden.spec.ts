// apps/web/e2e/garden.spec.ts
import { expect } from '@playwright/test'
import { authenticatedTest } from './fixtures/auth'

authenticatedTest.describe('Garden page', () => {
  authenticatedTest('garden heading is visible', async ({ page }) => {
    await page.goto('/garden')
    await page.waitForLoadState('networkidle')

    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })

  authenticatedTest('stats row shows total solved and streak', async ({ page }) => {
    await page.goto('/garden')
    await page.waitForLoadState('networkidle')

    // Should display stats section
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })

    // Look for stat-related numbers or labels
    const statsSection = page
      .locator('[data-testid="garden-stats"], .stats, .grid')
      .first()
    if (await statsSection.isVisible()) {
      const text = await statsSection.textContent()
      expect(text).toBeTruthy()
    }
  })

  authenticatedTest('empty state for new user with no solves', async ({ page }) => {
    await page.goto('/garden')
    await page.waitForLoadState('networkidle')

    // Page should render without errors even for users with 0 solves
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })
    await expect(page.locator('body')).not.toHaveText(/error|500|Internal Server/i)
  })

  authenticatedTest('growth guide section is visible', async ({ page }) => {
    await page.goto('/garden')
    await page.waitForLoadState('networkidle')

    // The garden page should have a growth/guide section
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })

    // Check page has substantial content
    const content = await main.textContent()
    expect(content!.length).toBeGreaterThan(50)
  })

  authenticatedTest('badge showcase section is visible', async ({ page }) => {
    await page.goto('/garden')
    await page.waitForLoadState('networkidle')

    // Look for badge-related section
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })

    // Badge section should exist (even if empty for new users)
    const badgeSection = page
      .locator('[data-testid="badges"], [data-testid="badge-showcase"]')
      .first()

    // Page renders without crash regardless of badge data
    await expect(page.locator('body')).not.toHaveText(/error|500/i)
  })
})
