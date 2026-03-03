import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Only run unit tests in __tests__/ — exclude Playwright e2e specs
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}', 'lib/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
