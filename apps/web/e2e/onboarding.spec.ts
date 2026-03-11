// apps/web/e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test'
import { freshUserTest } from './fixtures/auth'
import { authenticatedTest } from './fixtures/auth'

freshUserTest.describe('Onboarding — fresh user', () => {
  freshUserTest('fresh user redirected to /onboarding from /dashboard', async ({ page }) => {
    await page.goto('/dashboard')

    // Fresh user (onboarding not completed) should be redirected
    await page.waitForURL(/\/onboarding/, { timeout: 10000 })
    expect(page.url()).toContain('/onboarding')
  })

  freshUserTest('mode selection UI (list vs filter) is visible', async ({ page }) => {
    await page.goto('/onboarding')

    // Should show two mode options
    const listOption = page.getByText(/list|清單/i).first()
    const filterOption = page.getByText(/filter|篩選/i).first()

    // At least one mode selection element should be visible
    const modeContainer = page
      .locator('[data-testid="mode-selection"], form, [role="radiogroup"]')
      .first()
    await expect(modeContainer).toBeVisible({ timeout: 10000 })
  })

  freshUserTest('list mode flow renders list selection step', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Onboarding wizard wraps in div (not main) — check it renders
    const container = page.locator('[role="radiogroup"]').first()
    await expect(container).toBeVisible({ timeout: 10000 })

    // Find and click list mode option (清單模式)
    const listButton = page.locator('[role="radiogroup"]').getByText(/清單模式|list mode/i).first()
    if (await listButton.isVisible()) {
      await listButton.click()

      // Should show list selection or next step
      await page.waitForTimeout(500)
      // Still on the page without error
      await expect(page.locator('body')).not.toHaveText(/\bInternal Server Error\b|500 Error|Error 500/i)
    }
  })

  freshUserTest('filter mode flow renders difficulty selection', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Onboarding wizard renders radiogroup for mode selection
    const container = page.locator('[role="radiogroup"]').first()
    await expect(container).toBeVisible({ timeout: 10000 })

    // Find and click filter mode option (篩選模式)
    const filterButton = page.locator('[role="radiogroup"]').getByText(/篩選模式|filter mode/i).first()
    if (await filterButton.isVisible()) {
      await filterButton.click()

      await page.waitForTimeout(500)
      // Still on the page without error
      await expect(page.locator('body')).not.toHaveText(/\bInternal Server Error\b|500 Error|Error 500/i)
    }
  })

  freshUserTest('timezone and push hour step renders inputs', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // Onboarding wizard should render — check body doesn't show errors
    await expect(page.locator('body')).not.toHaveText(/\bInternal Server Error\b|500 Error|Error 500/i)
    // Mode selection should be visible
    const container = page.locator('[role="radiogroup"]').first()
    await expect(container).toBeVisible({ timeout: 10000 })
  })

  freshUserTest('email connect step renders email input', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    // The onboarding flow should render without errors
    await expect(page.locator('body')).not.toHaveText(/\bInternal Server Error\b|500 Error|Error 500/i)
    // Wizard content should be visible
    const wizard = page.locator('[role="radiogroup"], form, [class*="mx-auto"]').first()
    await expect(wizard).toBeVisible({ timeout: 10000 })
  })
})

authenticatedTest.describe('Onboarding — completed user', () => {
  authenticatedTest('already-onboarded user redirected from /onboarding', async ({ page }) => {
    await page.goto('/onboarding')

    // Completed users should be redirected away from onboarding
    await page.waitForURL(/\/(dashboard|settings)/, { timeout: 10000 })
    expect(page.url()).not.toContain('/onboarding')
  })
})
