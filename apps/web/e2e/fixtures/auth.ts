// apps/web/e2e/fixtures/auth.ts
import { test as base } from '@playwright/test'

// Authenticated user (onboarding completed, not admin)
export const authenticatedTest = base.extend({
  storageState: async ({}, use) => {
    await use('e2e/.auth/user.json')
  },
})

// Admin user
export const adminTest = base.extend({
  storageState: async ({}, use) => {
    await use('e2e/.auth/admin.json')
  },
})

// Fresh user (onboarding not completed)
export const freshUserTest = base.extend({
  storageState: async ({}, use) => {
    await use('e2e/.auth/fresh.json')
  },
})
