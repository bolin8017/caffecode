// apps/worker/src/__tests__/registry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to reset modules between tests to re-evaluate registry.ts
// with different config values, so we use dynamic imports.

describe('channelRegistry', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('includes telegram + line channels when tokens are set', async () => {
    vi.doMock('../lib/config.js', () => ({
      config: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        TELEGRAM_BOT_TOKEN: 'test-telegram-token',
        LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
        APP_URL: 'https://caffecode.net',
        RESEND_API_KEY: undefined,
      },
    }))

    const { channelRegistry } = await import('../channels/registry.js')

    expect(channelRegistry).toHaveProperty('telegram')
    expect(channelRegistry).toHaveProperty('line')
    expect(channelRegistry.telegram).toBeDefined()
    expect(channelRegistry.line).toBeDefined()
  })

  it('includes email channel when RESEND_API_KEY is set', async () => {
    vi.doMock('../lib/config.js', () => ({
      config: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        TELEGRAM_BOT_TOKEN: 'test-telegram-token',
        LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
        APP_URL: 'https://caffecode.net',
        RESEND_API_KEY: 're_test_key',
        RESEND_FROM_EMAIL: 'CaffeCode <noreply@caffecode.net>',
      },
    }))

    const { channelRegistry } = await import('../channels/registry.js')

    expect(channelRegistry).toHaveProperty('email')
    expect(channelRegistry.email).toBeDefined()
  })

  it('excludes email channel when RESEND_API_KEY is absent', async () => {
    vi.doMock('../lib/config.js', () => ({
      config: {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        TELEGRAM_BOT_TOKEN: 'test-telegram-token',
        LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
        APP_URL: 'https://caffecode.net',
        RESEND_API_KEY: undefined,
      },
    }))

    const { channelRegistry } = await import('../channels/registry.js')

    expect(channelRegistry).not.toHaveProperty('email')
  })
})
