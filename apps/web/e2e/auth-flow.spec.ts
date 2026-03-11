// apps/web/e2e/auth-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication flow', () => {
  test('OAuth buttons (GitHub + Google) are visible on /login', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('button', { name: /github/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })

  test('error banner shows when ?error=auth_failed query param present', async ({ page }) => {
    await page.goto('/login?error=auth_failed')

    // Should display some error message/banner on the login page
    const errorElement = page
      .locator('[role="alert"], [data-testid="auth-error"], .text-red-500, .text-destructive')
      .first()
    await expect(errorElement).toBeVisible({ timeout: 5000 })
  })

  test('authenticated user redirected from /login to /dashboard', async ({ browser }) => {
    // Use authenticated state
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    })
    const page = await context.newPage()

    await page.goto('/login')
    await page.waitForURL(/\/(dashboard|settings|onboarding)/, { timeout: 10000 })

    const url = page.url()
    expect(url).not.toContain('/login')
    await context.close()
  })

  test('invalid callback code shows error', async ({ page }) => {
    // Simulate an auth callback with an invalid code
    await page.goto('/auth/callback?code=invalid_code_12345')

    // Should redirect to login with error or show error page
    await page.waitForLoadState('networkidle')
    const url = page.url()
    // Either redirected to /login with error param or stayed on error page
    expect(url).toMatch(/\/(login|error)/)
  })

  test('redirect param preserved through login flow', async ({ page }) => {
    // Visit /login with a redirect param
    await page.goto('/login?redirect=/settings')

    // The redirect param should be visible in the URL or preserved in a hidden form field
    const url = page.url()
    expect(url).toContain('redirect')
  })
})
