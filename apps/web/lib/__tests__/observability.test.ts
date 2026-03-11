import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSentryInit = vi.fn()
const mockPosthogInit = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
  // Clean up window stub if set
  if ((globalThis as Record<string, unknown>).__windowStubbed) {
    // @ts-expect-error restoring original state
    delete globalThis.window
    delete (globalThis as Record<string, unknown>).__windowStubbed
  }
})

describe('initSentry', () => {
  it('is a no-op when SENTRY_DSN is undefined', async () => {
    vi.stubEnv('SENTRY_DSN', '')
    vi.doMock('@sentry/nextjs', () => ({ init: mockSentryInit }))
    const { initSentry } = await import('../sentry')
    initSentry()
    expect(mockSentryInit).not.toHaveBeenCalled()
  })

  it('calls Sentry.init when SENTRY_DSN is set', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.io/123')
    vi.stubEnv('NODE_ENV', 'production')
    vi.doMock('@sentry/nextjs', () => ({ init: mockSentryInit }))
    const { initSentry } = await import('../sentry')
    initSentry()
    expect(mockSentryInit).toHaveBeenCalledWith({
      dsn: 'https://key@sentry.io/123',
      environment: 'production',
      tracesSampleRate: 0.1,
    })
  })
})

describe('initPostHog', () => {
  it('is a no-op when typeof window is undefined (SSR)', async () => {
    // In Node vitest env, window is already undefined by default
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test123')
    vi.doMock('posthog-js', () => ({ default: { init: mockPosthogInit } }))
    const { initPostHog } = await import('../posthog')
    initPostHog()
    expect(mockPosthogInit).not.toHaveBeenCalled()
  })

  it('is a no-op when NEXT_PUBLIC_POSTHOG_KEY is undefined', async () => {
    // Provide window but no key
    vi.stubGlobal('window', {})
    ;(globalThis as Record<string, unknown>).__windowStubbed = true
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '')
    vi.doMock('posthog-js', () => ({ default: { init: mockPosthogInit } }))
    const { initPostHog } = await import('../posthog')
    initPostHog()
    expect(mockPosthogInit).not.toHaveBeenCalled()
  })

  it('calls posthog.init when key is available and in browser', async () => {
    // Stub window to simulate browser
    vi.stubGlobal('window', {})
    ;(globalThis as Record<string, unknown>).__windowStubbed = true
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test123')
    // Remove POSTHOG_HOST so the ?? fallback kicks in
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
    vi.doMock('posthog-js', () => ({ default: { init: mockPosthogInit } }))
    const { initPostHog } = await import('../posthog')
    initPostHog()
    expect(mockPosthogInit).toHaveBeenCalledWith('phc_test123', {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
    })
  })
})
