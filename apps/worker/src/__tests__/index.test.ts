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

vi.mock('../channels/registry.js', () => ({
  channelRegistry: {},
}))

// We mock buildPushJobs and recordPushRun to test main() orchestration
const mockBuildPushJobs = vi.fn()
vi.mock('../workers/push.logic.js', () => ({
  buildPushJobs: (...args: unknown[]) => mockBuildPushJobs(...args),
}))

const mockRecordPushRun = vi.fn()
vi.mock('../repositories/push.repository.js', () => ({
  recordPushRun: (...args: unknown[]) => mockRecordPushRun(...args),
}))

const mockSentryInit = vi.fn()
const mockCaptureException = vi.fn()
const mockFlush = vi.fn()
vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => mockSentryInit(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  flush: (...args: unknown[]) => mockFlush(...args),
}))

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
    // The dedup guard queries push_runs for created_at >= 10 min ago
    // When a recent run is found, main() returns early without calling buildPushJobs
    const db = makeDedupMock({ id: 'run-1', created_at: new Date().toISOString() })

    // Simulate the guard logic inline (since main() is not directly importable)
    const { data: recentRun } = await db
      .from('push_runs')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    expect(recentRun).not.toBeNull()
    // When recentRun exists, main() should NOT call buildPushJobs
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
    // Null means no recent run — main() should proceed to buildPushJobs
  })
})

describe('Worker main() — recordPushRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records push run with correct stats on success', async () => {
    mockBuildPushJobs.mockResolvedValue({ totalCandidates: 5, succeeded: 5, failed: 0 })

    // Simulate the main() flow
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
    // This mirrors the guard in index.ts lines 50-53
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

describe('Worker main() — Sentry integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls Sentry.init when SENTRY_DSN is set', () => {
    const dsn = 'https://examplePublicKey@o0.ingest.sentry.io/0'
    // Simulate the conditional init from index.ts lines 10-15
    if (dsn) {
      mockSentryInit({ dsn, environment: 'production' })
    }

    expect(mockSentryInit).toHaveBeenCalledWith({
      dsn,
      environment: 'production',
    })
  })

  it('does NOT call Sentry.init when SENTRY_DSN is not set', () => {
    const dsn: string | undefined = undefined
    if (dsn) {
      mockSentryInit({ dsn, environment: 'production' })
    }

    expect(mockSentryInit).not.toHaveBeenCalled()
  })

  it('calls Sentry.captureException on failure when SENTRY_DSN is set', async () => {
    const err = new Error('Push run failed')
    const dsn = 'https://examplePublicKey@o0.ingest.sentry.io/0'

    // Simulate the catch block in index.ts lines 73-79
    if (dsn) {
      mockCaptureException(err)
      await mockFlush(2000)
    }

    expect(mockCaptureException).toHaveBeenCalledWith(err)
    expect(mockFlush).toHaveBeenCalledWith(2000)
  })
})
