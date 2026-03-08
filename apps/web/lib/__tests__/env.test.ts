import { describe, it, expect } from 'vitest'
import { serverEnvSchema } from '../env'

describe('serverEnvSchema', () => {
  it('validates when all required fields are present', () => {
    const result = serverEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
      LINE_CHANNEL_SECRET: 'test-secret',
      TELEGRAM_BOT_USERNAME: 'CaffeCodeBot',
    })
    expect(result.success).toBe(true)
  })

  it('fails when required fields are missing', () => {
    const result = serverEnvSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = serverEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
      LINE_CHANNEL_SECRET: 'test-secret',
      TELEGRAM_BOT_USERNAME: 'CaffeCodeBot',
      RESEND_API_KEY: 're_test',
      SENTRY_DSN: 'https://test@sentry.io/123',
    })
    expect(result.success).toBe(true)
  })
})
