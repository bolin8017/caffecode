import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mock shared + logger — must be before importing badge.repository
// ---------------------------------------------------------------------------
vi.mock('@caffecode/shared', () => ({
  evaluateBadgeCondition: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { checkAndAwardBadges, getUserBadges } from '@/lib/repositories/badge.repository'
import { evaluateBadgeCondition } from '@caffecode/shared'
import type { UserBadgeContext } from '@caffecode/shared'

const mockEvaluate = vi.mocked(evaluateBadgeCondition)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ctx: UserBadgeContext = {
  totalSolves: 10,
  currentStreak: 5,
  topicLevels: [{ topic: 'array', level: 3 }],
  topicCount: 4,
}

const allBadges = [
  { id: 1, slug: 'first-solve', name: 'First Solve', icon: '1', category: 'milestone', requirement: { type: 'total_solves', threshold: 1 } },
  { id: 2, slug: 'streak-3', name: '3-Day Streak', icon: '3', category: 'streak', requirement: { type: 'streak', threshold: 3 } },
  { id: 3, slug: 'streak-7', name: '7-Day Streak', icon: '7', category: 'streak', requirement: { type: 'streak', threshold: 7 } },
]

/**
 * Build mock Supabase that supports multiple from() calls with different tables.
 * Uses a call counter to return different results for sequential from() calls.
 */
function makeBadgeMock(opts: {
  allBadgesData?: unknown
  allBadgesError?: unknown
  earnedData?: unknown
  earnedError?: unknown
  insertError?: unknown
}) {
  const insertMock = vi.fn().mockResolvedValue({ error: opts.insertError ?? null })
  let callIndex = 0
  const fromMock = vi.fn().mockImplementation(() => {
    callIndex++
    if (callIndex === 1) {
      // First call: badges table
      return {
        select: vi.fn().mockResolvedValue({
          data: opts.allBadgesData ?? allBadges,
          error: opts.allBadgesError ?? null,
        }),
      }
    }
    if (callIndex === 2) {
      // Second call: user_badges table (read earned)
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: opts.earnedData ?? [],
            error: opts.earnedError ?? null,
          }),
        }),
      }
    }
    // Third call: user_badges table (insert)
    return { insert: insertMock }
  })
  return { db: { from: fromMock } as unknown as SupabaseClient, fromMock, insertMock }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// checkAndAwardBadges
// ---------------------------------------------------------------------------
describe('checkAndAwardBadges', () => {
  it('awards new badges when conditions are met', async () => {
    // All 3 unearned, 2 meet condition
    mockEvaluate.mockImplementation((req) => {
      const r = req as { type: string; threshold: number }
      if (r.type === 'total_solves') return true
      if (r.type === 'streak' && r.threshold === 3) return true
      return false
    })
    const { db } = makeBadgeMock({ earnedData: [] })

    const result = await checkAndAwardBadges(db, 'user-1', ctx)
    expect(result).toHaveLength(2)
    expect(result.map(b => b.slug)).toContain('first-solve')
    expect(result.map(b => b.slug)).toContain('streak-3')
  })

  it('returns [] when all badges are already earned', async () => {
    const { db } = makeBadgeMock({
      earnedData: [{ badge_id: 1 }, { badge_id: 2 }, { badge_id: 3 }],
    })

    const result = await checkAndAwardBadges(db, 'user-1', ctx)
    expect(result).toEqual([])
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('returns [] when no unearned badges meet condition', async () => {
    mockEvaluate.mockReturnValue(false)
    const { db } = makeBadgeMock({ earnedData: [] })

    const result = await checkAndAwardBadges(db, 'user-1', ctx)
    expect(result).toEqual([])
  })

  it('returns [] on badge fetch error', async () => {
    const { db } = makeBadgeMock({ allBadgesError: { message: 'timeout' } })

    const result = await checkAndAwardBadges(db, 'user-1', ctx)
    expect(result).toEqual([])
  })

  it('returns [] when allBadges data is null', async () => {
    const { db } = makeBadgeMock({ allBadgesData: null })

    const result = await checkAndAwardBadges(db, 'user-1', ctx)
    expect(result).toEqual([])
  })

  it('returns [] on earned fetch error', async () => {
    const { db } = makeBadgeMock({ earnedError: { message: 'denied' } })

    const result = await checkAndAwardBadges(db, 'user-1', ctx)
    expect(result).toEqual([])
  })

  it('returns [] and logs on insert error', async () => {
    mockEvaluate.mockReturnValue(true)
    const { db } = makeBadgeMock({ earnedData: [], insertError: { message: 'dup key' } })

    const result = await checkAndAwardBadges(db, 'user-1', ctx)
    expect(result).toEqual([])
  })

  it('skips insert when no badges to award (toAward empty)', async () => {
    mockEvaluate.mockReturnValue(false)
    const { db, insertMock } = makeBadgeMock({ earnedData: [] })

    await checkAndAwardBadges(db, 'user-1', ctx)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('handles mixed scenario: some earned, some met, some not', async () => {
    // Badge 1 already earned, badge 2 condition met, badge 3 condition not met
    mockEvaluate.mockImplementation((req) => {
      const r = req as { type: string; threshold: number }
      return r.type === 'streak' && r.threshold === 3
    })
    const { db } = makeBadgeMock({ earnedData: [{ badge_id: 1 }] })

    const result = await checkAndAwardBadges(db, 'user-1', ctx)
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('streak-3')
  })

  it('calls insert with correct badge_id and user_id', async () => {
    mockEvaluate.mockReturnValue(true)
    const { db, insertMock } = makeBadgeMock({ earnedData: [] })

    await checkAndAwardBadges(db, 'user-1', ctx)
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: 'user-1', badge_id: 1 }),
        expect.objectContaining({ user_id: 'user-1', badge_id: 2 }),
        expect.objectContaining({ user_id: 'user-1', badge_id: 3 }),
      ])
    )
  })
})

// ---------------------------------------------------------------------------
// getUserBadges
// ---------------------------------------------------------------------------
describe('getUserBadges', () => {
  it('returns badges with earned_at on success', async () => {
    const data = [
      {
        earned_at: '2026-03-01T00:00:00Z',
        badges: { id: 1, slug: 'first-solve', name: 'First Solve', icon: '1', category: 'milestone' },
      },
    ]
    const orderMock = vi.fn().mockResolvedValue({ data, error: null })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getUserBadges(db, 'user-1')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 1,
      slug: 'first-solve',
      name: 'First Solve',
      icon: '1',
      category: 'milestone',
      earned_at: '2026-03-01T00:00:00Z',
    })
  })

  it('returns [] on DB error', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getUserBadges(db, 'user-1')
    expect(result).toEqual([])
  })

  it('returns [] when data is null', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getUserBadges(db, 'user-1')
    expect(result).toEqual([])
  })

  it('returns badges in earned_at DESC order', async () => {
    const data = [
      {
        earned_at: '2026-03-10T00:00:00Z',
        badges: { id: 2, slug: 'streak-3', name: '3-Day Streak', icon: '3', category: 'streak' },
      },
      {
        earned_at: '2026-03-05T00:00:00Z',
        badges: { id: 1, slug: 'first-solve', name: 'First Solve', icon: '1', category: 'milestone' },
      },
    ]
    const orderMock = vi.fn().mockResolvedValue({ data, error: null })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getUserBadges(db, 'user-1')
    expect(result).toHaveLength(2)
    expect(result[0].slug).toBe('streak-3')
    expect(result[0].earned_at).toBe('2026-03-10T00:00:00Z')
    expect(result[1].slug).toBe('first-solve')
    expect(result[1].earned_at).toBe('2026-03-05T00:00:00Z')
    // Verify order method was called with descending
    expect(orderMock).toHaveBeenCalled()
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('returns [] for empty badges array', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getUserBadges(db, 'user-1')
    expect(result).toEqual([])
  })
})
