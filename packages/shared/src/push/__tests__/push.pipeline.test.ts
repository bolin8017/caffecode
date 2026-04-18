import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LimitFunction } from 'p-limit'

vi.mock('../push.repository.js')
vi.mock('../../services/problem-selector.js', () => ({
  selectProblemForUser: vi.fn(),
}))

import { buildPushJobs } from '../push.logic.js'
import {
  getAllCandidates,
  getVerifiedChannelsBulk,
  upsertHistoryBatch,
  stampLastPushDate,
  advanceListPositions,
  resetChannelFailures,
} from '../push.repository.js'
import { selectProblemForUser } from '../../services/problem-selector.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationChannel } from '../channels/registry.js'
import { makeUser, makeProblem, makeChannel } from '../../__tests__/fixtures.js'

const mockGetAllCandidates = vi.mocked(getAllCandidates)
const mockGetChannels = vi.mocked(getVerifiedChannelsBulk)
const mockUpsertHistory = vi.mocked(upsertHistoryBatch)
const mockStamp = vi.mocked(stampLastPushDate)
const mockAdvance = vi.mocked(advanceListPositions)
const mockResetChannelFailures = vi.mocked(resetChannelFailures)
const mockSelectProblem = vi.mocked(selectProblemForUser)

const db = {} as SupabaseClient

// A p-limit stub that invokes the thunk immediately (no concurrency control needed in tests)
const noopLimit = vi.fn((fn: () => unknown) => fn()) as unknown as LimitFunction

// Channel registry stub: dispatches succeed without real HTTP calls
function makeChannelRegistry(channelTypes = ['telegram', 'email', 'line']): Record<string, NotificationChannel> {
  const channel: NotificationChannel = vi.fn().mockResolvedValue({ success: true })
  return Object.fromEntries(channelTypes.map(t => [t, channel]))
}

describe('buildPushJobs — pipeline orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsertHistory.mockResolvedValue(undefined)
    mockStamp.mockResolvedValue(undefined)
    mockAdvance.mockResolvedValue(undefined)
    mockResetChannelFailures.mockResolvedValue(undefined)
  })

  it('returns zero stats when no candidates exist', async () => {
    mockGetAllCandidates.mockResolvedValueOnce([])

    const stats = await buildPushJobs(db, {}, noopLimit)

    expect(stats).toEqual({ totalCandidates: 0, succeeded: 0, failed: 0 })
    expect(mockGetAllCandidates).toHaveBeenCalledWith(db)
  })

  it('dispatches jobs for 2 users with problems and channels', async () => {
    const user1 = makeUser({ id: 'u1' })
    const user2 = makeUser({ id: 'u2', active_mode: 'filter' })

    mockGetAllCandidates.mockResolvedValueOnce([user1, user2])
    mockSelectProblem
      .mockResolvedValueOnce(makeProblem({ problem_id: 10, slug: 'two-sum' }))
      .mockResolvedValueOnce(makeProblem({ problem_id: 20, slug: 'add-two-numbers' }))
    mockGetChannels.mockResolvedValueOnce([
      makeChannel({ id: 'ch-1', user_id: 'u1', channel_type: 'telegram' }),
      makeChannel({ id: 'ch-2', user_id: 'u2', channel_type: 'email', channel_identifier: 'a@b.com' }),
    ])

    const stats = await buildPushJobs(db, makeChannelRegistry(), noopLimit)

    expect(stats.totalCandidates).toBe(2)
    expect(stats.succeeded).toBe(2)
    expect(mockUpsertHistory).toHaveBeenCalledWith(db, [
      { userId: 'u1', problemId: 10 },
      { userId: 'u2', problemId: 20 },
    ])
    expect(mockStamp).toHaveBeenCalledWith(db, ['u1', 'u2'])
  })

  it('excludes LINE channel when line_push_allowed is false', async () => {
    const user = makeUser({ id: 'u1', line_push_allowed: false })

    mockGetAllCandidates.mockResolvedValueOnce([user])
    mockSelectProblem.mockResolvedValueOnce(makeProblem())
    mockGetChannels.mockResolvedValueOnce([
      makeChannel({ id: 'ch-line', user_id: 'u1', channel_type: 'line', channel_identifier: 'U123' }),
      makeChannel({ id: 'ch-tg', user_id: 'u1', channel_type: 'telegram' }),
    ])

    const stats = await buildPushJobs(db, makeChannelRegistry(), noopLimit)

    // Only telegram job dispatched (line filtered out), so succeeded=1
    expect(stats.succeeded).toBe(1)
    expect(mockUpsertHistory).toHaveBeenCalledWith(db, [{ userId: 'u1', problemId: 42 }])
  })

  it('skips user when no verified channels exist', async () => {
    mockGetAllCandidates.mockResolvedValueOnce([makeUser({ id: 'u1' })])
    mockSelectProblem.mockResolvedValueOnce(makeProblem())
    mockGetChannels.mockResolvedValueOnce([])

    const stats = await buildPushJobs(db, makeChannelRegistry(), noopLimit)

    expect(stats.succeeded).toBe(0)
    expect(mockGetChannels).toHaveBeenCalled()
    expect(mockUpsertHistory).not.toHaveBeenCalled()
    expect(mockStamp).not.toHaveBeenCalled()
  })

  it('skips user when no problem is found', async () => {
    mockGetAllCandidates.mockResolvedValueOnce([makeUser({ id: 'u1' })])
    mockSelectProblem.mockResolvedValueOnce(null)

    const stats = await buildPushJobs(db, makeChannelRegistry(), noopLimit)

    expect(stats.succeeded).toBe(0)
    expect(mockGetChannels).not.toHaveBeenCalled()
  })

  it('advances list positions for list-mode problems', async () => {
    mockGetAllCandidates.mockResolvedValueOnce([makeUser({ id: 'u1', active_mode: 'list' })])
    mockSelectProblem.mockResolvedValueOnce(
      makeProblem({ list_id: 5, sequence_number: 3 }),
    )
    mockGetChannels.mockResolvedValueOnce([makeChannel({ user_id: 'u1' })])

    await buildPushJobs(db, makeChannelRegistry(), noopLimit)

    expect(mockAdvance).toHaveBeenCalledWith(db, [
      { userId: 'u1', listId: 5, sequenceNumber: 3 },
    ])
  })

  it('fetches all candidates in a single snapshot and processes in batches of 100', async () => {
    // 130 candidates: first batch of 100, second batch of 30
    const allUsers = Array.from({ length: 130 }, (_, i) => makeUser({ id: `u${i}` }))

    mockGetAllCandidates.mockResolvedValueOnce(allUsers)
    mockSelectProblem.mockResolvedValue(makeProblem())
    mockGetChannels.mockImplementation(async (_db, userIds) =>
      userIds.map(uid => makeChannel({ user_id: uid, id: `ch-${uid}` })),
    )

    const stats = await buildPushJobs(db, makeChannelRegistry(), noopLimit)

    // getAllCandidates called exactly once (snapshot, no re-pagination)
    expect(mockGetAllCandidates).toHaveBeenCalledTimes(1)
    expect(stats.totalCandidates).toBe(130)
    expect(stats.succeeded).toBe(130)
    // processBatch called twice: once for users 0-99, once for users 100-129
    expect(mockGetChannels).toHaveBeenCalledTimes(2)
  })

  it('stamps each batch immediately after processing (not after all batches)', async () => {
    // Use 200 candidates to force 2 batches; verify stamp is called per-batch
    const allUsers = Array.from({ length: 200 }, (_, i) => makeUser({ id: `u${i}` }))

    mockGetAllCandidates.mockResolvedValueOnce(allUsers)
    mockSelectProblem.mockResolvedValue(makeProblem())
    mockGetChannels.mockImplementation(async (_db, userIds) =>
      userIds.map(uid => makeChannel({ user_id: uid, id: `ch-${uid}` })),
    )

    await buildPushJobs(db, makeChannelRegistry(), noopLimit)

    // stampLastPushDate should be called twice — once per batch, not once for all 200
    expect(mockStamp).toHaveBeenCalledTimes(2)
    // Each call stamps exactly 100 users
    expect(mockStamp.mock.calls[0][1]).toHaveLength(100)
    expect(mockStamp.mock.calls[1][1]).toHaveLength(100)
  })

  it('stamps only users with at least one successful send (mixed results)', async () => {
    const user1 = makeUser({ id: 'u1' })
    const user2 = makeUser({ id: 'u2' })

    mockGetAllCandidates.mockResolvedValueOnce([user1, user2])
    mockSelectProblem
      .mockResolvedValueOnce(makeProblem({ problem_id: 10 }))
      .mockResolvedValueOnce(makeProblem({ problem_id: 20 }))
    mockGetChannels.mockResolvedValueOnce([
      makeChannel({ id: 'ch-1', user_id: 'u1', channel_type: 'telegram', channel_identifier: 'tg-u1' }),
      makeChannel({ id: 'ch-2', user_id: 'u2', channel_type: 'telegram', channel_identifier: 'tg-u2' }),
    ])

    const registry: Record<string, NotificationChannel> = {
      telegram: vi.fn().mockImplementation(async (identifier: string) => {
        if (identifier === 'tg-u1') return { success: true }
        return { success: false, shouldRetry: false, error: 'permanent failure' }
      }),
    }

    const stats = await buildPushJobs(db, registry, noopLimit)

    expect(stats.succeeded).toBe(1)
    expect(stats.failed).toBe(1)
    expect(mockStamp).toHaveBeenCalledWith(db, ['u1'])
    expect(mockUpsertHistory).toHaveBeenCalledWith(db, [{ userId: 'u1', problemId: 10 }])
    // Per-channel reset: only ch-1 delivered successfully (u2's ch-2 permanently failed)
    expect(mockResetChannelFailures).toHaveBeenCalledWith(db, ['ch-1'])
  })

  it('does not stamp any users when all sends fail', async () => {
    mockGetAllCandidates.mockResolvedValueOnce([makeUser({ id: 'u1' })])
    mockSelectProblem.mockResolvedValueOnce(makeProblem())
    mockGetChannels.mockResolvedValueOnce([makeChannel({ id: 'ch-1', user_id: 'u1' })])

    const registry: Record<string, NotificationChannel> = {
      telegram: vi.fn().mockResolvedValue({ success: false, shouldRetry: false, error: 'blocked' }),
    }

    const stats = await buildPushJobs(db, registry, noopLimit)

    expect(stats.succeeded).toBe(0)
    expect(stats.failed).toBe(1)
    expect(mockStamp).not.toHaveBeenCalled()
    expect(mockUpsertHistory).not.toHaveBeenCalled()
    expect(mockResetChannelFailures).not.toHaveBeenCalled()
  })

  it('handles selectProblemForUser throwing for one user without affecting others', async () => {
    const user1 = makeUser({ id: 'u1' })
    const user2 = makeUser({ id: 'u2' })

    mockGetAllCandidates.mockResolvedValueOnce([user1, user2])
    mockSelectProblem
      .mockRejectedValueOnce(new Error('RPC timeout'))
      .mockResolvedValueOnce(makeProblem({ problem_id: 20 }))
    mockGetChannels.mockResolvedValueOnce([
      makeChannel({ id: 'ch-2', user_id: 'u2' }),
    ])

    const stats = await buildPushJobs(db, makeChannelRegistry(), noopLimit)

    // u1 failed selection (thrown), u2 succeeded
    expect(stats.succeeded).toBe(1)
    expect(mockStamp).toHaveBeenCalledWith(db, ['u2'])
    expect(mockUpsertHistory).toHaveBeenCalledWith(db, [{ userId: 'u2', problemId: 20 }])
  })
})
