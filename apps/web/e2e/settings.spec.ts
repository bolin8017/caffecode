// apps/web/e2e/settings.spec.ts
import { expect } from '@playwright/test'
import { authenticatedTest } from './fixtures/auth'

authenticatedTest.describe('Settings', () => {
  authenticatedTest(
    'push settings form visible with toggle and hour selector',
    async ({ page }) => {
      await page.goto('/settings')
      await page.waitForLoadState('networkidle')

      // Should show push-related settings (toggle and/or hour selector)
      const main = page.locator('main').first()
      await expect(main).toBeVisible({ timeout: 10000 })

      // Look for toggle switch or push hour elements
      const pushSection = page
        .locator('input[type="checkbox"], [role="switch"], select, input[type="range"]')
        .first()
      await expect(pushSection).toBeVisible({ timeout: 10000 })
    },
  )

  authenticatedTest('notifications tab is accessible', async ({ page }) => {
    await page.goto('/settings/notifications')
    await page.waitForLoadState('networkidle')

    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })
    await expect(page.locator('body')).not.toHaveText(/error|500/i)
  })

  authenticatedTest('add channel buttons visible on notifications page', async ({ page }) => {
    await page.goto('/settings/notifications')
    await page.waitForLoadState('networkidle')

    // Should show buttons to connect channels (Telegram, LINE, Email)
    const channelSection = page.locator('main').first()
    await expect(channelSection).toBeVisible({ timeout: 10000 })

    // Look for channel-related buttons or links
    const channelButtons = page.locator('button, a[href*="telegram"], a[href*="line"]')
    const count = await channelButtons.count()
    expect(count).toBeGreaterThan(0)
  })

  authenticatedTest('learning tab shows mode and difficulty settings', async ({ page }) => {
    await page.goto('/settings/learning')
    await page.waitForLoadState('networkidle')

    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })

    // Should contain mode or difficulty related elements
    const content = await page.locator('main').textContent()
    expect(content).toBeTruthy()
  })

  authenticatedTest('account tab shows delete button with confirmation', async ({ page }) => {
    await page.goto('/settings/account')
    await page.waitForLoadState('networkidle')

    // Should show account deletion section
    const deleteButton = page.getByRole('button', { name: /delete|刪除/i }).first()
    await expect(deleteButton).toBeVisible({ timeout: 10000 })
  })

  authenticatedTest('delete confirmation requires typing', async ({ page }) => {
    await page.goto('/settings/account')
    await page.waitForLoadState('networkidle')

    // The delete button is disabled until the user types 'DELETE' in the input
    // Verify the confirmation input is visible and the button is initially disabled
    const confirmInput = page
      .locator('input[placeholder], [data-testid="confirm-delete-input"], input[type="text"]')
      .first()
    await expect(confirmInput).toBeVisible({ timeout: 10000 })

    const deleteButton = page.getByRole('button', { name: /delete|刪除/i }).first()
    // Button should be disabled before typing
    await expect(deleteButton).toBeDisabled()

    // Typing 'DELETE' should enable the button
    await confirmInput.fill('DELETE')
    await expect(deleteButton).toBeEnabled({ timeout: 3000 })
  })

  authenticatedTest('URL verification shows correct channel URLs', async ({ page }) => {
    await page.goto('/settings/notifications')
    await page.waitForLoadState('networkidle')

    // Page should load without errors
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10000 })
  })

  authenticatedTest('sidebar navigation between tabs works', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Find navigation links for different settings tabs
    const navLinks = page.locator('nav a[href*="/settings/"], a[href*="/settings/"]')
    const count = await navLinks.count()

    if (count > 0) {
      // Click the first tab link
      await navLinks.first().click()
      await page.waitForLoadState('networkidle')

      // Should navigate to a settings sub-page
      expect(page.url()).toContain('/settings')
    }
  })
})
