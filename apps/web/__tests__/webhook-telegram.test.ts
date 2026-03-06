import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies before importing the route
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/repositories/channel.repository', () => ({
  verifyChannelByToken: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

// Stub env vars before the module reads them
vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-bot-token')
vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'test-webhook-secret')

// Stub global fetch for the internal sendTelegramMessage calls
const fetchMock = vi.fn().mockResolvedValue({ ok: true })
vi.stubGlobal('fetch', fetchMock)

function makeRequest(body: object, secretHeader?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secretHeader !== undefined) {
    headers['x-telegram-bot-api-secret-token'] = secretHeader
  }
  return new NextRequest('https://caffecode.net/api/telegram/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue({ ok: true })
  })

  it('returns 401 when secret header is missing', async () => {
    const { POST } = await import('../app/api/telegram/webhook/route')
    const req = makeRequest({ update_id: 1 })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when secret header is wrong', async () => {
    const { POST } = await import('../app/api/telegram/webhook/route')
    const req = makeRequest({ update_id: 1 }, 'xxxx-webhook-secret')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when secret header has different byte length', async () => {
    const { POST } = await import('../app/api/telegram/webhook/route')
    const req = makeRequest({ update_id: 1 }, 'short')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns ok for valid secret with no text message', async () => {
    const { POST } = await import('../app/api/telegram/webhook/route')
    const req = makeRequest(
      { update_id: 1, message: { message_id: 1, chat: { id: 111 } } },
      'test-webhook-secret'
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('sends welcome message on /start command', async () => {
    const { POST } = await import('../app/api/telegram/webhook/route')
    const req = makeRequest(
      { update_id: 1, message: { message_id: 1, chat: { id: 111 }, text: '/start' } },
      'test-webhook-secret'
    )
    await POST(req)
    expect(fetchMock).toHaveBeenCalled()
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(callBody.chat_id).toBe(111)
    expect(callBody.text).toContain('歡迎')
  })

  it('verifies channel on valid link token', async () => {
    const { verifyChannelByToken } = await import('@/lib/repositories/channel.repository')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial mock
    vi.mocked(verifyChannelByToken).mockResolvedValue({ user_id: 'u1' } as any)

    const { POST } = await import('../app/api/telegram/webhook/route')
    const req = makeRequest(
      { update_id: 1, message: { message_id: 1, chat: { id: 111 }, text: '/start link_a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
      'test-webhook-secret'
    )
    await POST(req)

    expect(verifyChannelByToken).toHaveBeenCalledWith(expect.anything(), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '111', 'telegram')
  })

  it('sends failure message when link token is invalid', async () => {
    const { verifyChannelByToken } = await import('@/lib/repositories/channel.repository')
    vi.mocked(verifyChannelByToken).mockResolvedValue(null)

    const { POST } = await import('../app/api/telegram/webhook/route')
    const req = makeRequest(
      { update_id: 1, message: { message_id: 1, chat: { id: 111 }, text: '/start link_00000000-0000-0000-0000-000000000000' } },
      'test-webhook-secret'
    )
    await POST(req)

    expect(fetchMock).toHaveBeenCalled()
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(callBody.text).toContain('連結失敗')
  })

  it('sends settings link for other text messages', async () => {
    const { POST } = await import('../app/api/telegram/webhook/route')
    const req = makeRequest(
      { update_id: 1, message: { message_id: 1, chat: { id: 111 }, text: 'hello' } },
      'test-webhook-secret'
    )
    await POST(req)

    expect(fetchMock).toHaveBeenCalled()
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(callBody.text).toContain('caffecode.net/settings')
  })
})
