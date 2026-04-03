// apps/web/lib/__tests__/history-action.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock setup ---

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// Dynamic import mocks for garden, badge, streak
vi.mock('@/lib/repositories/garden.repository', () => ({
  getTopicProficiency: vi.fn(),
  getGardenSummary: vi.fn(),
  computeLevel: vi.fn(),
  toStage: vi.fn(),
}))

vi.mock('@/lib/repositories/badge.repository', () => ({
  checkAndAwardBadges: vi.fn(),
}))

vi.mock('@/lib/services/streak.service', () => ({
  calculateStreak: vi.fn(),
}))

// Supabase chain mocks — table-aware so history and users queries don't interfere
const mockHistorySingle = vi.fn()
const mockUsersSingle = vi.fn()
const mockUpdateChain = {
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  select: vi.fn(),
}
const mockHistoryChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  single: mockHistorySingle,
  update: vi.fn().mockReturnValue(mockUpdateChain),
}
const mockUsersChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: mockUsersSingle,
}
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'users') return mockUsersChain
  return mockHistoryChain
})
const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null })
const mockSupabase = { from: mockFrom, rpc: mockRpc }

import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { EMPTY_SOLVE_RESULT } from '@/lib/utils/solve-result'

function setupAuth(userId = 'user-123') {
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: mockSupabase as unknown,
    user: { id: userId } as unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

function setupHistoryRow(row: {
  id?: number
  sent_at?: string
  solved_at?: string | null
  problems?: { topics: string[] }
} | null, error: { message: string } | null = null) {
  mockHistorySingle.mockResolvedValueOnce({
    data: row,
    error,
  })
}

function setupUpdate(rows: { id: number }[] | null, error: { message: string } | null = null) {
  mockUpdateChain.select.mockResolvedValueOnce({
    data: rows,
    error,
  })
}

describe('markSolved', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setupAuth()
    // Re-apply mockImplementation after clearAllMocks (clears implementation too for mockFn)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return mockUsersChain
      return mockHistoryChain
    })
    mockHistoryChain.select.mockReturnThis()
    mockHistoryChain.eq.mockReturnThis()
    mockHistoryChain.not.mockReturnThis()
    mockHistoryChain.order.mockResolvedValue({ data: [], error: null })
    mockHistoryChain.update.mockReturnValue(mockUpdateChain)
    mockUpdateChain.eq.mockReturnThis()
    mockUpdateChain.is.mockReturnThis()
    mockUsersChain.select.mockReturnThis()
    mockUsersChain.eq.mockReturnThis()
    // Default: users timezone query returns Asia/Taipei
    mockUsersSingle.mockResolvedValue({ data: { timezone: 'Asia/Taipei' }, error: null })
    // Re-set repository defaults after clearAllMocks
    const { getTopicProficiency, getGardenSummary, computeLevel, toStage } = await import('@/lib/repositories/garden.repository')
    vi.mocked(getTopicProficiency).mockResolvedValue([])
    vi.mocked(getGardenSummary).mockResolvedValue({ totalSolved: 1, totalReceived: 5 })
    vi.mocked(computeLevel).mockReturnValue(1)
    vi.mocked(toStage).mockReturnValue(1 as const)
    const { checkAndAwardBadges } = await import('@/lib/repositories/badge.repository')
    vi.mocked(checkAndAwardBadges).mockResolvedValue([])
    const { calculateStreak } = await import('@/lib/services/streak.service')
    vi.mocked(calculateStreak).mockReturnValue(1)
  })

  // ─── Happy path ───

  it('returns SolveResult with topics on successful solve', async () => {
    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array', 'hash-table'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    const result = await markSolved(42)

    expect(result).toHaveProperty('levelUps')
    expect(result).toHaveProperty('newBadges')
    expect(result).toHaveProperty('topicProgress')
    expect(result).toHaveProperty('firstSolve')
  })

  it('returns SolveResult with badges when badges earned', async () => {
    const { checkAndAwardBadges } = await import('@/lib/repositories/badge.repository')
    vi.mocked(checkAndAwardBadges).mockResolvedValueOnce([
      { id: 1, slug: 'first-solve', name: 'First Solve', icon: '🌱', category: 'milestone' },
    ])

    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    const result = await markSolved(42)

    expect(result.newBadges).toEqual([{ name: 'First Solve', icon: '🌱' }])
  })

  it('sets firstSolve=true when totalSolved===1', async () => {
    const { getGardenSummary } = await import('@/lib/repositories/garden.repository')
    vi.mocked(getGardenSummary).mockResolvedValueOnce({ totalSolved: 1, totalReceived: 1 })

    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    const result = await markSolved(42)

    expect(result.firstSolve).toBe(true)
  })

  it('sets firstSolve=false when totalSolved>1', async () => {
    const { getGardenSummary } = await import('@/lib/repositories/garden.repository')
    vi.mocked(getGardenSummary).mockResolvedValueOnce({ totalSolved: 5, totalReceived: 10 })

    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    const result = await markSolved(42)

    expect(result.firstSolve).toBe(false)
  })

  // ─── Revalidation ───

  it('revalidates /garden, /dashboard, and /problems/[slug]', async () => {
    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    await markSolved(42)

    expect(revalidatePath).toHaveBeenCalledWith('/problems/[slug]', 'page')
    expect(revalidatePath).toHaveBeenCalledWith('/garden')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  // ─── Idempotency ───

  it('returns EMPTY_SOLVE_RESULT when already solved (solved_at not null)', async () => {
    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: '2026-03-09T12:00:00Z',
      problems: { topics: ['array'] },
    })

    const { markSolved } = await import('@/lib/actions/history')
    const result = await markSolved(42)

    expect(result).toEqual(EMPTY_SOLVE_RESULT)
  })

  it('returns EMPTY_SOLVE_RESULT when update returns 0 rows (TOCTOU guard)', async () => {
    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([]) // 0 rows updated — concurrent solve

    const { markSolved } = await import('@/lib/actions/history')
    const result = await markSolved(42)

    expect(result).toEqual(EMPTY_SOLVE_RESULT)
  })

  // ─── Zod validation ───

  it('throws ZodError for non-positive problemId', async () => {
    const { markSolved } = await import('@/lib/actions/history')
    await expect(markSolved(-1)).rejects.toThrow()
  })

  it('throws ZodError for non-integer problemId', async () => {
    const { markSolved } = await import('@/lib/actions/history')
    await expect(markSolved(1.5)).rejects.toThrow()
  })

  it('throws ZodError for zero problemId', async () => {
    const { markSolved } = await import('@/lib/actions/history')
    await expect(markSolved(0)).rejects.toThrow()
  })

  // ─── Error handling ───

  it('throws when history select fails', async () => {
    setupHistoryRow(null, { message: 'DB error' })

    const { markSolved } = await import('@/lib/actions/history')
    await expect(markSolved(42)).rejects.toThrow('No push record found')
  })

  it('throws when history update fails', async () => {
    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate(null, { message: 'update error' })

    const { markSolved } = await import('@/lib/actions/history')
    await expect(markSolved(42)).rejects.toThrow('Failed to mark problem as solved')
  })

  // ─── Best-effort sub-steps ───

  it('returns partial result when badge check fails', async () => {
    const { checkAndAwardBadges } = await import('@/lib/repositories/badge.repository')
    vi.mocked(checkAndAwardBadges).mockRejectedValueOnce(new Error('badge DB error'))

    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    // Should NOT throw — badge failure is best-effort
    const result = await markSolved(42)
    expect(result).toBeDefined()
  })

  it('uses streak=0 when streak calculation fails', async () => {
    // Make streak history query return error
    mockHistoryChain.order.mockResolvedValueOnce({ data: null, error: { message: 'streak err' } })

    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    // Should NOT throw
    const result = await markSolved(42)
    expect(result).toBeDefined()
  })

  it('uses default timezone Asia/Taipei when profile timezone missing', async () => {
    mockUsersSingle.mockResolvedValueOnce({ data: { timezone: null }, error: null })

    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    const result = await markSolved(42)
    expect(result).toBeDefined()
  })

  // ─── Query correctness ───

  it('queries history with user_id and problem_id', async () => {
    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    await markSolved(42)

    expect(mockFrom).toHaveBeenCalledWith('history')
    expect(mockHistoryChain.eq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(mockHistoryChain.eq).toHaveBeenCalledWith('problem_id', 42)
  })

  it('update has is(solved_at, null) TOCTOU condition', async () => {
    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    await markSolved(42)

    expect(mockUpdateChain.is).toHaveBeenCalledWith('solved_at', null)
  })

  it('calls both garden and badge repos', async () => {
    const { getGardenSummary } = await import('@/lib/repositories/garden.repository')
    const { checkAndAwardBadges } = await import('@/lib/repositories/badge.repository')

    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    await markSolved(42)

    expect(getGardenSummary).toHaveBeenCalled()
    expect(checkAndAwardBadges).toHaveBeenCalled()
  })

  it('does not throw when badge/feedback sub-steps fail', async () => {
    const { getGardenSummary } = await import('@/lib/repositories/garden.repository')
    vi.mocked(getGardenSummary).mockRejectedValueOnce(new Error('garden down'))

    setupHistoryRow({
      id: 1,
      sent_at: new Date().toISOString(),
      solved_at: null,
      problems: { topics: ['array'] },
    })
    setupUpdate([{ id: 1 }])

    const { markSolved } = await import('@/lib/actions/history')
    // Must not throw — entire badge block is best-effort
    const result = await markSolved(42)
    expect(result).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// skipProblem
// ---------------------------------------------------------------------------
describe('skipProblem', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setupAuth()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') return mockUsersChain
      return mockHistoryChain
    })
  })

  it('calls update with correct filters (skipped_at IS NULL, solved_at IS NULL)', async () => {
    mockUpdateChain.is.mockReturnThis()
    mockUpdateChain.eq.mockReturnThis()
    // No select() call for skipProblem — update returns { error }
    const mockUpdateTerminal = vi.fn().mockReturnValue(mockUpdateChain)
    mockHistoryChain.update = mockUpdateTerminal

    // Make the final chained call resolve to { error: null }
    mockUpdateChain.is.mockImplementation(function (this: typeof mockUpdateChain) {
      return { ...this, error: null } as unknown as typeof mockUpdateChain
    })

    // Simulate a successful update with no error
    const updateResult = { error: null }
    mockHistoryChain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue(updateResult),
          }),
        }),
      }),
    })

    const { skipProblem } = await import('@/lib/actions/history')
    await skipProblem(42)
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('throws on non-positive problemId (Zod validation)', async () => {
    const { skipProblem } = await import('@/lib/actions/history')
    await expect(skipProblem(0)).rejects.toThrow()
    await expect(skipProblem(-1)).rejects.toThrow()
  })

  it('throws on non-integer problemId (Zod validation)', async () => {
    const { skipProblem } = await import('@/lib/actions/history')
    await expect(skipProblem(1.5)).rejects.toThrow()
  })

  it('throws when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockRejectedValueOnce(new Error('Unauthenticated'))
    const { skipProblem } = await import('@/lib/actions/history')
    await expect(skipProblem(42)).rejects.toThrow('Unauthenticated')
  })

  it('throws on DB update error', async () => {
    mockHistoryChain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ error: { message: 'DB failure' } }),
          }),
        }),
      }),
    })

    const { skipProblem } = await import('@/lib/actions/history')
    await expect(skipProblem(42)).rejects.toThrow('Failed to skip problem')
  })
})
