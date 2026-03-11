import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mock rating-calibration — must be before importing user.repository
// ---------------------------------------------------------------------------
vi.mock('@/lib/utils/rating-calibration', () => ({
  computeSuggestedRange: vi.fn(),
}))

import {
  getUserDashboard,
  getUserSettings,
  updateUser,
  getSuggestedRange,
} from '@/lib/repositories/user.repository'
import { computeSuggestedRange } from '@/lib/utils/rating-calibration'

const mockComputeSuggestedRange = vi.mocked(computeSuggestedRange)

// ---------------------------------------------------------------------------
// Chain mock factory
// ---------------------------------------------------------------------------
function makeChainMock(data: unknown, error: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const terminal = vi.fn().mockResolvedValue({ data, error })
  for (const method of [
    'select', 'eq', 'in', 'is', 'not', 'gt', 'order', 'limit',
    'update', 'delete', 'upsert', 'insert',
  ]) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  chain.single = terminal
  chain.maybeSingle = terminal
  const fromMock = vi.fn().mockReturnValue(chain)
  const rpcMock = vi.fn().mockResolvedValue({ data, error })
  const db = { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient
  return { db, fromMock, rpcMock, chain, terminal }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getUserDashboard
// ---------------------------------------------------------------------------
describe('getUserDashboard', () => {
  const dashboardData = {
    display_name: 'Alice',
    active_mode: 'filter',
    push_enabled: true,
    push_hour: 9,
    difficulty_min: 1200,
    difficulty_max: 1800,
    timezone: 'Asia/Taipei',
  }

  it('returns user dashboard data on success', async () => {
    const { db } = makeChainMock(dashboardData)
    const result = await getUserDashboard(db, 'user-1')
    expect(result).toEqual(dashboardData)
  })

  it('throws on DB error', async () => {
    const { db } = makeChainMock(null, { message: 'connection timeout' })
    await expect(getUserDashboard(db, 'user-1')).rejects.toThrow(
      'Failed to fetch user dashboard: connection timeout'
    )
  })

  it('calls from("users") with correct select fields and eq(id)', async () => {
    const { db, fromMock, chain } = makeChainMock(dashboardData)
    await getUserDashboard(db, 'user-1')

    expect(fromMock).toHaveBeenCalledWith('users')
    expect(chain.select).toHaveBeenCalledWith(
      'display_name, active_mode, push_enabled, push_hour, difficulty_min, difficulty_max, timezone'
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('returns null when data is null (no error)', async () => {
    // single() can return { data: null, error: null } if row not found via maybeSingle behavior
    // But user.repository uses .single() which throws PGRST116 on no row.
    // However, the function returns `data` directly — if data is null it returns null.
    const terminal = vi.fn().mockResolvedValue({ data: null, error: null })
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['select', 'eq']) {
      chain[method] = vi.fn().mockReturnValue(chain)
    }
    chain.single = terminal
    const fromMock = vi.fn().mockReturnValue(chain)
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getUserDashboard(db, 'user-1')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getUserSettings
// ---------------------------------------------------------------------------
describe('getUserSettings', () => {
  it('returns user settings on success', async () => {
    const settings = {
      push_enabled: true,
      push_hour: 9,
      timezone: 'Asia/Taipei',
      line_push_allowed: false,
    }
    const { db } = makeChainMock(settings)
    const result = await getUserSettings(db, 'user-1')
    expect(result).toEqual(settings)
  })

  it('throws on DB error', async () => {
    const { db } = makeChainMock(null, { message: 'db down' })
    await expect(getUserSettings(db, 'user-1')).rejects.toThrow(
      'Failed to fetch user settings: db down'
    )
  })

  it('returns null when user not found (data is null)', async () => {
    const { db } = makeChainMock(null)
    const result = await getUserSettings(db, 'nonexistent-user')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// updateUser
// ---------------------------------------------------------------------------
describe('updateUser', () => {
  it('resolves without error on success', async () => {
    // updateUser doesn't use .single() — the chain ends at .eq()
    // Override chain.eq to return the terminal-like promise
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(updateUser(db, 'user-1', { push_enabled: false })).resolves.toBeUndefined()
  })

  it('calls from("users").update(data).eq("id", userId)', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const data = { push_enabled: false, timezone: 'UTC' }
    await updateUser(db, 'user-1', data)

    expect(fromMock).toHaveBeenCalledWith('users')
    expect(updateMock).toHaveBeenCalledWith(data)
    expect(eqMock).toHaveBeenCalledWith('id', 'user-1')
  })

  it('throws on DB error', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'constraint violation' } })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(updateUser(db, 'user-1', { push_enabled: true })).rejects.toThrow(
      'Failed to update user: constraint violation'
    )
  })

  it('passes only provided fields in partial update', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await updateUser(db, 'user-1', { timezone: 'America/New_York' })
    expect(updateMock).toHaveBeenCalledWith({ timezone: 'America/New_York' })
  })
})

// ---------------------------------------------------------------------------
// getSuggestedRange
// ---------------------------------------------------------------------------
describe('getSuggestedRange', () => {
  const feedbackRows = [
    { difficulty: 'just_right', problems: { rating: 1500 } },
    { difficulty: 'too_easy', problems: { rating: 1200 } },
    { difficulty: 'just_right', problems: { rating: 1600 } },
    { difficulty: 'too_hard', problems: { rating: 2000 } },
    { difficulty: 'just_right', problems: { rating: 1550 } },
  ]

  it('returns {min, max} when computeSuggestedRange returns a range', async () => {
    // getSuggestedRange uses: from → select → eq → not → order → limit (no .single)
    const limitMock = vi.fn().mockResolvedValue({ data: feedbackRows, error: null })
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock })
    const notMock = vi.fn().mockReturnValue({ order: orderMock })
    const eqMock = vi.fn().mockReturnValue({ not: notMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    mockComputeSuggestedRange.mockReturnValue({ min: 1400, max: 1750 })

    const result = await getSuggestedRange(db, 'user-1')
    expect(result).toEqual({ min: 1400, max: 1750 })
  })

  it('returns null when fewer than 3 valid signals', async () => {
    const fewRows = [
      { difficulty: 'just_right', problems: { rating: 1500 } },
      { difficulty: 'too_easy', problems: { rating: null } }, // filtered out (null rating)
    ]
    const limitMock = vi.fn().mockResolvedValue({ data: fewRows, error: null })
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock })
    const notMock = vi.fn().mockReturnValue({ order: orderMock })
    const eqMock = vi.fn().mockReturnValue({ not: notMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getSuggestedRange(db, 'user-1')
    expect(result).toBeNull()
    expect(mockComputeSuggestedRange).not.toHaveBeenCalled()
  })

  it('returns null on DB error', async () => {
    const limitMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } })
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock })
    const notMock = vi.fn().mockReturnValue({ order: orderMock })
    const eqMock = vi.fn().mockReturnValue({ not: notMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getSuggestedRange(db, 'user-1')
    expect(result).toBeNull()
  })

  it('returns a range when exactly 3 valid signals (boundary)', async () => {
    const exactlyThreeRows = [
      { difficulty: 'just_right', problems: { rating: 1500 } },
      { difficulty: 'too_easy', problems: { rating: 1200 } },
      { difficulty: 'too_hard', problems: { rating: 2000 } },
    ]
    const limitMock = vi.fn().mockResolvedValue({ data: exactlyThreeRows, error: null })
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock })
    const notMock = vi.fn().mockReturnValue({ order: orderMock })
    const eqMock = vi.fn().mockReturnValue({ not: notMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    mockComputeSuggestedRange.mockReturnValue({ min: 1300, max: 1800 })

    const result = await getSuggestedRange(db, 'user-1')
    expect(result).toEqual({ min: 1300, max: 1800 })
    expect(mockComputeSuggestedRange).toHaveBeenCalledWith([
      { difficulty: 'just_right', rating: 1500 },
      { difficulty: 'too_easy', rating: 1200 },
      { difficulty: 'too_hard', rating: 2000 },
    ])
  })

  it('returns null when computeSuggestedRange returns null', async () => {
    const limitMock = vi.fn().mockResolvedValue({ data: feedbackRows, error: null })
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock })
    const notMock = vi.fn().mockReturnValue({ order: orderMock })
    const eqMock = vi.fn().mockReturnValue({ not: notMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    mockComputeSuggestedRange.mockReturnValue(null)

    const result = await getSuggestedRange(db, 'user-1')
    expect(result).toBeNull()
  })
})
