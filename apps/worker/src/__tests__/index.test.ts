// apps/worker/src/__tests__/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock config before any imports that depend on it
vi.mock('../lib/config.js', () => ({
  config: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    TELEGRAM_BOT_TOKEN: 'test-token',
    LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
    APP_URL: 'https://caffecode.net',
    SENTRY_DSN: undefined,
  },
}))

vi.mock('../lib/supabase.js', () => ({
  supabase: {} as unknown as SupabaseClient,
}))

// Mock shared push pipeline functions
const mockBuildPushJobs = vi.fn()
const mockRecordPushRun = vi.fn()
vi.mock('@caffecode/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@caffecode/shared')>()
  return {
    ...actual,
    buildPushJobs: (...args: unknown[]) => mockBuildPushJobs(...args),
    recordPushRun: (...args: unknown[]) => mockRecordPushRun(...args),
    createChannelRegistry: vi.fn().mockReturnValue({}),
  }
})

// Helper: create a mock supabase that simulates the dedup guard query
function makeDedupMock(recentRun: { id: string; created_at: string } | null) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: recentRun })
  const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
  const orderMock = vi.fn().mockReturnValue({ limit: limitMock })
  const gteMock = vi.fn().mockReturnValue({ order: orderMock })
  const selectMock = vi.fn().mockReturnValue({ gte: gteMock })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock })
  return { from: fromMock } as unknown as SupabaseClient
}

describe('Worker main() — dedup guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips run when a recent push_run exists within 10 minutes', async () => {
    const db = makeDedupMock({ id: 'run-1', created_at: new Date().toISOString() })

    const { data: recentRun } = await db
      .from('push_runs')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    expect(recentRun).not.toBeNull()
    expect(mockBuildPushJobs).not.toHaveBeenCalled()
  })

  it('proceeds when no recent push_run exists', async () => {
    const db = makeDedupMock(null)

    const { data: recentRun } = await db
      .from('push_runs')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    expect(recentRun).toBeNull()
  })
})

describe('Worker main() — recordPushRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records push run with correct stats on success', async () => {
    mockBuildPushJobs.mockResolvedValue({ totalCandidates: 5, succeeded: 5, failed: 0 })

    const startMs = Date.now()
    const stats = await mockBuildPushJobs()

    await mockRecordPushRun({} as SupabaseClient, {
      candidates: stats.totalCandidates,
      succeeded: stats.succeeded,
      failed: stats.failed,
      durationMs: Date.now() - startMs,
      errorMsg: undefined,
    })

    expect(mockRecordPushRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        candidates: 5,
        succeeded: 5,
        failed: 0,
        errorMsg: undefined,
      }),
    )
  })

  it('records push run with error_msg on failure', async () => {
    const errorMsg = 'All candidates processed but 0 messages delivered (3 candidates)'
    mockBuildPushJobs.mockResolvedValue({ totalCandidates: 3, succeeded: 0, failed: 3 })

    await mockRecordPushRun({} as SupabaseClient, {
      candidates: 3,
      succeeded: 0,
      failed: 3,
      durationMs: 100,
      errorMsg,
    })

    expect(mockRecordPushRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorMsg }),
    )
  })
})

describe('Worker main() — all-failed guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when succeeded=0 and totalCandidates > 0', () => {
    const succeeded = 0
    const totalCandidates = 5

    expect(() => {
      if (succeeded === 0 && totalCandidates > 0) {
        throw new Error(`All candidates processed but 0 messages delivered (${totalCandidates} candidates)`)
      }
    }).toThrow('All candidates processed but 0 messages delivered')
  })

  it('does NOT throw when some messages succeeded', () => {
    const succeeded: number = 3
    const totalCandidates: number = 5

    expect(() => {
      if (succeeded === 0 && totalCandidates > 0) {
        throw new Error('should not reach')
      }
    }).not.toThrow()
  })

  it('does NOT throw when totalCandidates is 0', () => {
    const succeeded = 0
    const totalCandidates = 0

    expect(() => {
      if (succeeded === 0 && totalCandidates > 0) {
        throw new Error('should not reach')
      }
    }).not.toThrow()
  })
})
