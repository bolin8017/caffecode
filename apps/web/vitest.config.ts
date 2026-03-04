import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // Only run unit tests in __tests__/ — exclude Playwright e2e specs
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}', 'lib/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
