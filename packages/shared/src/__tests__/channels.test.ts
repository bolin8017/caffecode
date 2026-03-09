import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PushMessage } from '../types/push.js'

const msg: PushMessage = {
  title: 'Two Sum',
  difficulty: 'Easy',
  leetcodeId: 1,
  explanation: 'Use a hash map.',
  url: 'https://caffecode.net/problems/two-sum',
  problemSlug: 'two-sum',
  problemId: 1,
}

let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
  vi.resetModules()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// sendTelegramMessage
// ---------------------------------------------------------------------------
describe('sendTelegramMessage', () => {
  it('returns success when Telegram API responds 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
    const { sendTelegramMessage } = await import('../channels/telegram.js')
    const result = await sendTelegramMessage('bot-token', '12345', msg)
    expect(result).toEqual({ success: true, shouldRetry: false })
  })

  it('sends correct request body to Telegram API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch
    const { sendTelegramMessage } = await import('../channels/telegram.js')
    await sendTelegramMessage('bot-token', '12345', msg)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.chat_id).toBe('12345')
    expect(body.parse_mode).toBe('HTML')
    expect(body).toHaveProperty('reply_markup')
  })

  it('returns shouldRetry:false for 403 Forbidden', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 403, text: () => Promise.resolve('Forbidden'),
    })
    const { sendTelegramMessage } = await import('../channels/telegram.js')
    const result = await sendTelegramMessage('bot-token', '12345', msg)
    expect(result.success).toBe(false)
    expect(result.shouldRetry).toBe(false)
  })

  it('returns shouldRetry:false for 400 Bad Request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: () => Promise.resolve('Bad Request'),
    })
    const { sendTelegramMessage } = await import('../channels/telegram.js')
    const result = await sendTelegramMessage('bot-token', '12345', msg)
    expect(result.shouldRetry).toBe(false)
  })

  it('returns shouldRetry:true for 500 Server Error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, text: () => Promise.resolve('Internal Server Error'),
    })
    const { sendTelegramMessage } = await import('../channels/telegram.js')
    const result = await sendTelegramMessage('bot-token', '12345', msg)
    expect(result.shouldRetry).toBe(true)
  })

  it('returns shouldRetry:true on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    const { sendTelegramMessage } = await import('../channels/telegram.js')
    const result = await sendTelegramMessage('bot-token', '12345', msg)
    expect(result.success).toBe(false)
    expect(result.shouldRetry).toBe(true)
  })

  it('truncates long error body to at most 200 chars in SendResult.error', async () => {
    const longBody = 'x'.repeat(500)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(longBody),
    })
    const { sendTelegramMessage } = await import('../channels/telegram.js')
    const result = await sendTelegramMessage('bot-token', '12345', msg)
    expect(result.success).toBe(false)
    // The error field is "HTTP 429: <body slice(0,200)>" — total length may exceed 200
    // but the body portion must not exceed 200 chars.
    const errorStr = result.error ?? ''
    // Strip the "HTTP 429: " prefix (10 chars) to isolate the body portion
    const bodyPortion = errorStr.replace(/^HTTP \d+: /, '')
    expect(bodyPortion.length).toBeLessThanOrEqual(200)
    expect(bodyPortion).not.toBe(longBody)
  })
})

// ---------------------------------------------------------------------------
// sendLineMessage
// ---------------------------------------------------------------------------
describe('sendLineMessage', () => {
  it('returns success when LINE API responds 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
    const { sendLineMessage } = await import('../channels/line.js')
    const result = await sendLineMessage('line-token', 'U1234', msg)
    expect(result).toEqual({ success: true, shouldRetry: false })
  })

  it('sends correct auth header and flex message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch
    const { sendLineMessage } = await import('../channels/line.js')
    await sendLineMessage('line-token', 'U1234', msg)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({ method: 'POST' })
    )
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer line-token')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.to).toBe('U1234')
    expect(body.messages[0].type).toBe('flex')
    expect(body.messages[0].contents.type).toBe('bubble')
  })

  it('returns shouldRetry:false for 400', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, text: () => Promise.resolve('Bad Request'),
    })
    const { sendLineMessage } = await import('../channels/line.js')
    const result = await sendLineMessage('line-token', 'U1234', msg)
    expect(result.shouldRetry).toBe(false)
  })

  it('returns shouldRetry:false for 403', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 403, text: () => Promise.resolve('Forbidden'),
    })
    const { sendLineMessage } = await import('../channels/line.js')
    const result = await sendLineMessage('line-token', 'U1234', msg)
    expect(result.shouldRetry).toBe(false)
  })

  it('returns shouldRetry:true for 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, text: () => Promise.resolve('Server Error'),
    })
    const { sendLineMessage } = await import('../channels/line.js')
    const result = await sendLineMessage('line-token', 'U1234', msg)
    expect(result.shouldRetry).toBe(true)
  })

  it('returns shouldRetry:true on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout'))
    const { sendLineMessage } = await import('../channels/line.js')
    const result = await sendLineMessage('line-token', 'U1234', msg)
    expect(result.success).toBe(false)
    expect(result.shouldRetry).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// sendEmailMessage
// ---------------------------------------------------------------------------
describe('sendEmailMessage', () => {
  it('returns success when Resend API responds 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
    const { sendEmailMessage } = await import('../channels/email.js')
    const result = await sendEmailMessage('re_key', 'from@test.com', 'to@test.com', msg)
    expect(result).toEqual({ success: true, shouldRetry: false })
  })

  it('sends plain text payload when no html option', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch
    const { sendEmailMessage } = await import('../channels/email.js')
    await sendEmailMessage('re_key', 'from@test.com', 'to@test.com', msg)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).toHaveProperty('text')
    expect(body).not.toHaveProperty('html')
    expect(body.from).toBe('from@test.com')
    expect(body.to).toBe('to@test.com')
  })

  it('sends html payload when opts.html is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch
    const { sendEmailMessage } = await import('../channels/email.js')
    await sendEmailMessage('re_key', 'from@test.com', 'to@test.com', msg, { html: '<p>Hello</p>' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.html).toBe('<p>Hello</p>')
    expect(body).not.toHaveProperty('text')
  })

  it('sends correct Resend API headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch
    const { sendEmailMessage } = await import('../channels/email.js')
    await sendEmailMessage('re_key', 'from@test.com', 'to@test.com', msg)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' })
    )
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer re_key')
  })

  it('returns shouldRetry:false for 422', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 422, text: () => Promise.resolve('Unprocessable'),
    })
    const { sendEmailMessage } = await import('../channels/email.js')
    const result = await sendEmailMessage('re_key', 'from@test.com', 'to@test.com', msg)
    expect(result.shouldRetry).toBe(false)
  })

  it('returns shouldRetry:true for 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, text: () => Promise.resolve('Server Error'),
    })
    const { sendEmailMessage } = await import('../channels/email.js')
    const result = await sendEmailMessage('re_key', 'from@test.com', 'to@test.com', msg)
    expect(result.shouldRetry).toBe(true)
  })
})
