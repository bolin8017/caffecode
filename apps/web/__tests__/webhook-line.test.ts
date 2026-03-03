import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/repositories/channel.repository', () => ({
  verifyChannelByToken: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

vi.stubEnv('LINE_CHANNEL_SECRET', 'test-line-secret')
vi.stubEnv('LINE_CHANNEL_ACCESS_TOKEN', 'test-line-token')

const fetchMock = vi.fn().mockResolvedValue({ ok: true })
vi.stubGlobal('fetch', fetchMock)

function signBody(body: string, secret = 'test-line-secret'): string {
  return createHmac('sha256', secret).update(body).digest('base64')
}

function makeSignedRequest(body: object): NextRequest {
  const rawBody = JSON.stringify(body)
  const sig = signBody(rawBody)
  return new NextRequest('https://caffecode.net/api/line/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': sig,
    },
    body: rawBody,
  })
}

function makeRequest(body: object, signature?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature !== undefined) {
    headers['x-line-signature'] = signature
  }
  return new NextRequest('https://caffecode.net/api/line/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/line/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue({ ok: true })
  })

  it('returns 401 when signature is missing', async () => {
    const { POST } = await import('../app/api/line/webhook/route')
    const req = makeRequest({ events: [] })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when signature is wrong', async () => {
    const { POST } = await import('../app/api/line/webhook/route')
    const req = makeRequest({ events: [] }, 'wrong-signature')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns ok for valid signature with empty events', async () => {
    const { POST } = await import('../app/api/line/webhook/route')
    const req = makeSignedRequest({ events: [] })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('sends welcome on follow event', async () => {
    const { POST } = await import('../app/api/line/webhook/route')
    const body = {
      events: [{ type: 'follow', replyToken: 'rt-1', source: { userId: 'U1' } }],
    }
    const req = makeSignedRequest(body)
    await POST(req)

    expect(fetchMock).toHaveBeenCalled()
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(callBody.replyToken).toBe('rt-1')
    expect(callBody.messages[0].text).toContain('歡迎')
  })

  it('verifies channel on link_ message', async () => {
    const { verifyChannelByToken } = await import('@/lib/repositories/channel.repository')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial mock
    vi.mocked(verifyChannelByToken).mockResolvedValue({ user_id: 'u1' } as any)

    const { POST } = await import('../app/api/line/webhook/route')
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const body = {
      events: [{
        type: 'message',
        replyToken: 'rt-2',
        source: { userId: 'U1' },
        message: { type: 'text', text: `link_${uuid}` },
      }],
    }
    const req = makeSignedRequest(body)
    await POST(req)

    expect(verifyChannelByToken).toHaveBeenCalledWith(expect.anything(), uuid, 'U1', 'line')
  })

  it('sends failure reply when link token is invalid', async () => {
    const { verifyChannelByToken } = await import('@/lib/repositories/channel.repository')
    vi.mocked(verifyChannelByToken).mockResolvedValue(null)

    const { POST } = await import('../app/api/line/webhook/route')
    const body = {
      events: [{
        type: 'message',
        replyToken: 'rt-3',
        source: { userId: 'U1' },
        message: { type: 'text', text: 'link_bad-token' },
      }],
    }
    const req = makeSignedRequest(body)
    await POST(req)

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(callBody.messages[0].text).toContain('連結失敗')
  })
})
