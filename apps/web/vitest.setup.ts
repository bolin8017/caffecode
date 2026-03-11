import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// RTL auto-cleanup requires global afterEach (vitest globals: true).
// Since we don't use globals, register cleanup explicitly for jsdom tests.
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react')
    cleanup()
  }
})
