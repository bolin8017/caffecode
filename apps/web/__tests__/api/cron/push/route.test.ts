import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase chainable mock factory
// ---------------------------------------------------------------------------
function makeSupabaseMock(recentRun: object | null = null) {
  const chain = {
    select: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.gte.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.maybeSingle.mockResolvedValue({ data: recentRun, error: null })
  return { from: vi.fn().mockReturnValue(chain) }
}

// ---------------------------------------------------------------------------
// Module mocks (hoisted — evaluated before any import)
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))

vi.mock('@caffecode/worker/workers/push.logic', () => ({
  buildPushJobs: vi.fn(),
}))

vi.mock('@caffecode/worker/repositories/push.repository', () => ({
  recordPushRun: vi.fn(),
}))

vi.mock('@caffecode/worker/channels/telegram', () => ({
  TelegramChannel: vi.fn(),
}))

vi.mock('@caffecode/worker/channels/line', () => ({
  LineChannel: vi.fn(),
}))

vi.mock('@caffecode/worker/channels/email', () => ({
  EmailChannel: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader
  }
  return new Request('https://caffecode.net/api/cron/push', {
    method: 'POST',
    headers,
  })
}

async function importRoute() {
  return import('../../../../app/api/cron/push/route')
}

async function getCreateServiceClient() {
  const mod = await import('@/lib/supabase/server')
  return vi.mocked(mod.createServiceClient)
}

async function getBuildPushJobs() {
  const mod = await import('@caffecode/worker/workers/push.logic')
  return vi.mocked(mod.buildPushJobs)
}

async function getRecordPushRun() {
  const mod = await import('@caffecode/worker/repositories/push.repository')
  return vi.mocked(mod.recordPushRun)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/cron/push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    process.env.CRON_SECRET = 'test-secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    process.env.TELEGRAM_BOT_TOKEN = 'test-telegram'
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-line'
    delete process.env.RESEND_API_KEY
  })

  it('returns 401 when Authorization header has wrong token', async () => {
    const createServiceClient = await getCreateServiceClient()
    createServiceClient.mockReturnValue(makeSupabaseMock(null) as never)

    const { POST } = await importRoute()
    const res = await POST(makeRequest('Bearer wrong-secret'))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when Authorization header is missing', async () => {
    const createServiceClient = await getCreateServiceClient()
    createServiceClient.mockReturnValue(makeSupabaseMock(null) as never)

    const { POST } = await importRoute()
    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when CRON_SECRET env var is undefined', async () => {
    delete process.env.CRON_SECRET

    const createServiceClient = await getCreateServiceClient()
    createServiceClient.mockReturnValue(makeSupabaseMock(null) as never)

    const { POST } = await importRoute()
    const res = await POST(makeRequest('Bearer test-secret'))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('skips and returns skipped:true when a recent push run exists', async () => {
    const recentRun = { id: 'abc-123', created_at: new Date().toISOString() }

    const createServiceClient = await getCreateServiceClient()
    createServiceClient.mockReturnValue(makeSupabaseMock(recentRun) as never)

    const buildPushJobs = await getBuildPushJobs()

    const { POST } = await importRoute()
    const res = await POST(makeRequest('Bearer test-secret'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ skipped: true, reason: 'recent_run' })
    expect(buildPushJobs).not.toHaveBeenCalled()
  })

  it('runs push pipeline and returns stats on success', async () => {
    const createServiceClient = await getCreateServiceClient()
    createServiceClient.mockReturnValue(makeSupabaseMock(null) as never)

    const buildPushJobs = await getBuildPushJobs()
    const recordPushRun = await getRecordPushRun()

    buildPushJobs.mockResolvedValue({ succeeded: 8, failed: 2, totalCandidates: 10 })
    recordPushRun.mockResolvedValue(undefined)

    const { POST } = await importRoute()
    const res = await POST(makeRequest('Bearer test-secret'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.candidates).toBe(10)
    expect(body.succeeded).toBe(8)
    expect(body.failed).toBe(2)
    expect(typeof body.durationMs).toBe('number')

    expect(recordPushRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ candidates: 10, succeeded: 8, failed: 2 }),
    )
  })

  it('handles push pipeline errors gracefully and still calls recordPushRun', async () => {
    const createServiceClient = await getCreateServiceClient()
    createServiceClient.mockReturnValue(makeSupabaseMock(null) as never)

    const buildPushJobs = await getBuildPushJobs()
    const recordPushRun = await getRecordPushRun()

    buildPushJobs.mockRejectedValue(new Error('DB connection lost'))
    recordPushRun.mockResolvedValue(undefined)

    const { POST } = await importRoute()
    const res = await POST(makeRequest('Bearer test-secret'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(false)

    expect(recordPushRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorMsg: 'Error: DB connection lost' }),
    )
  })
})
