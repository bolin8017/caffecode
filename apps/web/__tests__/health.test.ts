import { describe, it, expect, vi, beforeEach } from 'vitest'

// Build a chainable Supabase mock that resolves with { error: null } by default
function makeDbMock(error: object | null = null) {
  const chain = { select: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() }
  chain.select.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.maybeSingle.mockResolvedValue({ data: { id: 1 }, error })
  return { from: vi.fn().mockReturnValue(chain) }
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns status ok with expected fields when DB is reachable', async () => {
    const { createServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock() as never)

    const { GET } = await import('../app/api/health/route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body).toHaveProperty('timestamp')
  })

  it('returns 503 when DB is unreachable', async () => {
    const { createServiceClient } = await import('@/lib/supabase/server')
    vi.mocked(createServiceClient).mockReturnValue(makeDbMock({ message: 'connection refused' }) as never)

    const { GET } = await import('../app/api/health/route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('error')
  })
})
