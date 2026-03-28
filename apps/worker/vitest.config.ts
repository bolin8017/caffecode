import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@caffecode/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**', 'src/**/*.test.*', 'src/**/*.d.ts',
        'src/index.ts',            // entry-point orchestration (tested via index.test.ts mocks)
        'src/lib/config.ts',        // singleton re-export of parsed env
        'src/lib/supabase.ts',      // singleton Supabase client init
        'src/lib/logger.ts',        // singleton pino logger
      ],
    },
  },
})
