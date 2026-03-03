import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PushMessage } from '@caffecode/shared'

// Mock @react-email/render to avoid rendering React Email components in tests
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>mocked email</html>'),
}))

// Mock the shared sendEmailMessage to avoid real HTTP calls
const sendEmailMock = vi.fn()
vi.mock('@caffecode/shared', async () => {
  const actual = await vi.importActual<typeof import('@caffecode/shared')>('@caffecode/shared')
  return {
    ...actual,
    sendEmailMessage: (...args: unknown[]) => sendEmailMock(...args),
  }
})

import { EmailChannel } from '../channels/email.js'

const msg: PushMessage = {
  title: 'Two Sum',
  difficulty: 'Easy',
  leetcodeId: 1,
  explanation: 'Use a hash map to find complement.',
  url: 'https://caffecode.net/problems/two-sum',
  problemSlug: 'two-sum',
  problemId: 1,
}

describe('EmailChannel', () => {
  beforeEach(() => {
    sendEmailMock.mockReset()
    sendEmailMock.mockResolvedValue({ success: true, shouldRetry: false })
  })

  it('can be instantiated with apiKey and from', () => {
    const channel = new EmailChannel('fake-api-key', 'CaffeCode <noreply@caffecode.net>')
    expect(channel).toBeDefined()
  })

  it('formatMessage returns a non-empty string', () => {
    const channel = new EmailChannel('fake-api-key', 'CaffeCode <noreply@caffecode.net>')
    const result = channel.formatMessage(msg)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formatMessage includes the difficulty', () => {
    const channel = new EmailChannel('fake-api-key', 'CaffeCode <noreply@caffecode.net>')
    expect(channel.formatMessage(msg)).toContain('Easy')
  })

  it('formatMessage varies by difficulty', () => {
    const channel = new EmailChannel('fake-api-key', 'CaffeCode <noreply@caffecode.net>')
    const hard = { ...msg, difficulty: 'Hard' }
    const result = channel.formatMessage(hard)
    expect(result).toContain('Hard')
    expect(result).not.toContain('Easy')
  })

  it('send calls sendEmailMessage with correct arguments', async () => {
    const channel = new EmailChannel('fake-api-key', 'CaffeCode <noreply@caffecode.net>')

    const result = await channel.send('user@example.com', msg)

    expect(sendEmailMock).toHaveBeenCalledOnce()

    const [apiKey, from, to, passedMsg, opts] = sendEmailMock.mock.calls[0]
    expect(apiKey).toBe('fake-api-key')
    expect(from).toBe('CaffeCode <noreply@caffecode.net>')
    expect(to).toBe('user@example.com')
    expect(passedMsg).toEqual(msg)
    expect(opts).toHaveProperty('html')
    expect(typeof opts.html).toBe('string')
    expect(opts.html).toBe('<html>mocked email</html>')

    expect(result).toEqual({ success: true, shouldRetry: false })
  })

  it('send propagates failure result from sendEmailMessage', async () => {
    sendEmailMock.mockResolvedValue({ success: false, error: '422 Unprocessable', shouldRetry: false })

    const channel = new EmailChannel('fake-api-key', 'CaffeCode <noreply@caffecode.net>')
    const result = await channel.send('user@example.com', msg)

    expect(result.success).toBe(false)
    expect(result.shouldRetry).toBe(false)
  })
})
