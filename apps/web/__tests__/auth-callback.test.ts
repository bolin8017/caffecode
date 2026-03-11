// apps/web/__tests__/auth-callback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExchangeCodeForSession = vi.fn()
const mockCheckRateLimit = vi.fn()
const mockGetClientIp = vi.fn()
const mockSanitizeRedirect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  })),
}))

vi.mock('@/lib/utils/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: mockGetClientIp,
}))

vi.mock('@/lib/utils/safe-redirect', () => ({
  sanitizeRedirect: mockSanitizeRedirect,
}))

function makeCallbackRequest(params: Record<string, string> = {}): Request {
  const url = new URL('https://caffecode.net/auth/callback')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString(), {
    headers: new Headers({ 'x-forwarded-for': '1.2.3.4' }),
  })
}

describe('auth/callback GET handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue(true)
    mockGetClientIp.mockReturnValue('1.2.3.4')
    mockSanitizeRedirect.mockReturnValue('/dashboard')
  })

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockReturnValue(false)

    const { GET } = await import('../app/auth/callback/route')
    const res = await GET(makeCallbackRequest({ code: 'abc123' }))

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('Too many requests')
  })

  it('calls checkRateLimit with correct IP and limit=30', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const { GET } = await import('../app/auth/callback/route')
    await GET(makeCallbackRequest({ code: 'abc123' }))

    expect(mockCheckRateLimit).toHaveBeenCalledWith('1.2.3.4', 30)
  })

  it('extracts client IP via getClientIp from request headers', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const { GET } = await import('../app/auth/callback/route')
    await GET(makeCallbackRequest({ code: 'abc123' }))

    expect(mockGetClientIp).toHaveBeenCalledTimes(1)
    // getClientIp receives the Headers object
    const headersArg = mockGetClientIp.mock.calls[0][0]
    expect(headersArg.get('x-forwarded-for')).toBe('1.2.3.4')
  })

  it('redirects to sanitized path on successful code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockSanitizeRedirect.mockReturnValue('/settings')

    const { GET } = await import('../app/auth/callback/route')
    const res = await GET(makeCallbackRequest({ code: 'abc123', redirect: '/settings' }))

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/settings')
  })

  it('uses sanitizeRedirect to validate redirect param', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const { GET } = await import('../app/auth/callback/route')
    await GET(makeCallbackRequest({ code: 'abc123', redirect: '//evil.com' }))

    expect(mockSanitizeRedirect).toHaveBeenCalledWith('//evil.com')
  })

  it('defaults to /dashboard when no redirect param', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockSanitizeRedirect.mockReturnValue('/dashboard')

    const { GET } = await import('../app/auth/callback/route')
    const res = await GET(makeCallbackRequest({ code: 'abc123' }))

    expect(mockSanitizeRedirect).toHaveBeenCalledWith(null)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard')
  })

  it('redirects to /login?error=auth_failed when code missing', async () => {
    const { GET } = await import('../app/auth/callback/route')
    const res = await GET(makeCallbackRequest({}))

    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('auth_failed')
  })

  it('redirects to /login?error=auth_failed when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid code' } })

    const { GET } = await import('../app/auth/callback/route')
    const res = await GET(makeCallbackRequest({ code: 'bad-code' }))

    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('auth_failed')
  })

  it('redirects to /login?error=auth_failed when code is empty string', async () => {
    const { GET } = await import('../app/auth/callback/route')
    const res = await GET(makeCallbackRequest({ code: '' }))

    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('auth_failed')
  })

  it('does not call exchangeCodeForSession when code absent', async () => {
    const { GET } = await import('../app/auth/callback/route')
    await GET(makeCallbackRequest({}))

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })
})
