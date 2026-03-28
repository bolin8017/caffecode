import { describe, it, expect } from 'vitest'
import { createChannelRegistry } from '../channels/registry.js'

describe('createChannelRegistry', () => {
  it('includes telegram + line channels when tokens are provided', () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'test-telegram-token',
      lineChannelAccessToken: 'test-line-token',
    })

    expect(registry).toHaveProperty('telegram')
    expect(registry).toHaveProperty('line')
    expect(registry.telegram).toBeDefined()
    expect(registry.line).toBeDefined()
  })

  it('includes email channel when resendApiKey is provided', () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'test-telegram-token',
      lineChannelAccessToken: 'test-line-token',
      resendApiKey: 're_test_key',
      resendFromEmail: 'CaffeCode <noreply@caffecode.net>',
    })

    expect(registry).toHaveProperty('email')
    expect(registry.email).toBeDefined()
  })

  it('excludes email channel when resendApiKey is absent', () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'test-telegram-token',
      lineChannelAccessToken: 'test-line-token',
    })

    expect(registry).not.toHaveProperty('email')
  })
})
