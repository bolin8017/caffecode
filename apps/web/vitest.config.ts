import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@caffecode/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@caffecode/worker/(.*)': path.resolve(__dirname, '../../apps/worker/src/$1'),
    },
  },
  test: {
    // Only run unit tests in __tests__/ — exclude Playwright e2e specs
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}', 'lib/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['lib/**/*.ts', 'app/**/route.ts'],
      exclude: [
        'lib/**/__tests__/**', '**/*.test.*', '**/*.d.ts',
        'lib/logger.ts',       // singleton Pino instance
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
})
