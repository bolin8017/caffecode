import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PushMessage } from '../../types/push.js'

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>mocked email</html>'),
}))

const sendTelegramMock = vi.fn().mockResolvedValue({ success: true })
const sendLineMock = vi.fn().mockResolvedValue({ success: true })
const sendEmailMock = vi.fn().mockResolvedValue({ success: true })

vi.mock('../../channels/telegram.js', () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMock(...args),
}))
vi.mock('../../channels/line.js', () => ({
  sendLineMessage: (...args: unknown[]) => sendLineMock(...args),
}))
vi.mock('../../channels/email.js', () => ({
  sendEmailMessage: (...args: unknown[]) => sendEmailMock(...args),
}))

import { createChannelRegistry } from '../channels/registry.js'

const msg: PushMessage = {
  title: 'Two Sum',
  difficulty: 'Easy',
  leetcodeId: 1,
  explanation: 'Use a hash map.',
  url: 'https://caffecode.net/problems/two-sum',
  problemSlug: 'two-sum',
  problemId: 42,
}

describe('createChannelRegistry', () => {
  beforeEach(() => {
    sendTelegramMock.mockClear()
    sendLineMock.mockClear()
    sendEmailMock.mockClear()
  })

  it('includes telegram + line channels when tokens are provided', () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'test-telegram-token',
      lineChannelAccessToken: 'test-line-token',
    })

    expect(typeof registry.telegram).toBe('function')
    expect(typeof registry.line).toBe('function')
  })

  it('includes email channel when resendApiKey is provided', () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'test-telegram-token',
      lineChannelAccessToken: 'test-line-token',
      resendApiKey: 're_test_key',
      resendFromEmail: 'CaffeCode <noreply@caffecode.net>',
    })

    expect(typeof registry.email).toBe('function')
  })

  it('excludes email channel when resendApiKey is absent', () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'test-telegram-token',
      lineChannelAccessToken: 'test-line-token',
    })

    expect(registry.email).toBeUndefined()
  })

  it('telegram channel delegates to sendTelegramMessage with token', async () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'tg-token',
      lineChannelAccessToken: 'line-token',
    })

    await registry.telegram!('12345', msg)
    expect(sendTelegramMock).toHaveBeenCalledWith('tg-token', '12345', msg)
  })

  it('line channel delegates to sendLineMessage with token', async () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'tg-token',
      lineChannelAccessToken: 'line-token',
    })

    await registry.line!('line-user', msg)
    expect(sendLineMock).toHaveBeenCalledWith('line-token', 'line-user', msg)
  })

  it('email channel renders template and delegates to sendEmailMessage', async () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'tg-token',
      lineChannelAccessToken: 'line-token',
      resendApiKey: 're_key',
      resendFromEmail: 'CaffeCode <noreply@caffecode.net>',
    })

    await registry.email!('user@example.com', msg)
    expect(sendEmailMock).toHaveBeenCalledWith(
      're_key',
      'CaffeCode <noreply@caffecode.net>',
      'user@example.com',
      msg,
      { html: '<html>mocked email</html>' },
    )
  })

  it('email channel uses default from address when resendFromEmail is omitted', async () => {
    const registry = createChannelRegistry({
      telegramBotToken: 'tg-token',
      lineChannelAccessToken: 'line-token',
      resendApiKey: 're_key',
    })

    await registry.email!('user@example.com', msg)
    expect(sendEmailMock).toHaveBeenCalledWith(
      're_key',
      'CaffeCode <noreply@caffecode.net>',
      'user@example.com',
      msg,
      { html: '<html>mocked email</html>' },
    )
  })
})
