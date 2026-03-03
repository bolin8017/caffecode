import { describe, it, expect } from 'vitest'
import { envSchema } from '../lib/config.schema.js'

const validEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  TELEGRAM_BOT_TOKEN: 'bot-token',
  LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
  RESEND_API_KEY: 're_api_key',
}

describe('envSchema (worker config)', () => {
  it('parses valid env successfully', () => {
    const result = envSchema.safeParse(validEnv)
    expect(result.success).toBe(true)
  })

  it('applies defaults for optional fields', () => {
    const result = envSchema.safeParse(validEnv)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.APP_URL).toBe('https://caffecode.net')
      expect(result.data.RESEND_FROM_EMAIL).toBe('CaffeCode <noreply@caffecode.net>')
    }
  })

  it('fails when a required field is missing', () => {
    const { TELEGRAM_BOT_TOKEN: _, ...missingToken } = validEnv
    const result = envSchema.safeParse(missingToken)
    expect(result.success).toBe(false)
  })
})
