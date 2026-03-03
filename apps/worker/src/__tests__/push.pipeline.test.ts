import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/config.js', () => ({
  config: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    APP_URL: 'https://caffecode.net',
    TELEGRAM_BOT_TOKEN: 'test-token',
    LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'CaffeCode <noreply@caffecode.net>',
  },
}))

vi.mock('../repositories/push.repository.js')
vi.mock('../services/problem-selector.js')

import { buildPushJobs } from '../workers/push.logic.js'
import {
  getPushCandidatesBatch,
  getVerifiedChannelsBulk,
  upsertHistoryBatch,
  stampLastPushDate,
  advanceListPositions,
  type PushCandidate,
  type VerifiedChannel,
} from '../repositories/push.repository.js'
import { selectProblemForUser } from '../services/problem-selector.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SelectedProblem } from '@caffecode/shared'

const mockGetBatch = vi.mocked(getPushCandidatesBatch)
const mockGetChannels = vi.mocked(getVerifiedChannelsBulk)
const mockUpsertHistory = vi.mocked(upsertHistoryBatch)
const mockStamp = vi.mocked(stampLastPushDate)
const mockAdvance = vi.mocked(advanceListPositions)
const mockSelectProblem = vi.mocked(selectProblemForUser)

const db = {} as SupabaseClient

function makeUser(overrides: Partial<PushCandidate> = {}): PushCandidate {
  return {
    id: 'user-1',
    timezone: 'Asia/Taipei',
    active_mode: 'list',
    difficulty_min: 0,
    difficulty_max: 3000,
    topic_filter: null,
    line_push_allowed: true,
    ...overrides,
  }
}

function makeProblem(overrides: Partial<SelectedProblem> = {}): SelectedProblem {
  return {
    problem_id: 42,
    leetcode_id: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    explanation: 'Use a hash map.',
    ...overrides,
  }
}

function makeChannel(overrides: Partial<VerifiedChannel> = {}): VerifiedChannel {
  return {
    id: 'ch-1',
    user_id: 'user-1',
    channel_type: 'telegram',
    channel_identifier: '123456',
    ...overrides,
  }
}

describe('buildPushJobs — pipeline orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsertHistory.mockResolvedValue(undefined)
    mockStamp.mockResolvedValue(undefined)
    mockAdvance.mockResolvedValue(undefined)
  })

  it('builds jobs for 2 users with problems and channels', async () => {
    const user1 = makeUser({ id: 'u1' })
    const user2 = makeUser({ id: 'u2', active_mode: 'filter' })

    mockGetBatch.mockResolvedValueOnce([user1, user2])
    mockSelectProblem
      .mockResolvedValueOnce(makeProblem({ problem_id: 10, slug: 'two-sum' }))
      .mockResolvedValueOnce(makeProblem({ problem_id: 20, slug: 'add-two-numbers' }))
    mockGetChannels.mockResolvedValueOnce([
      makeChannel({ id: 'ch-1', user_id: 'u1', channel_type: 'telegram' }),
      makeChannel({ id: 'ch-2', user_id: 'u2', channel_type: 'email', channel_identifier: 'a@b.com' }),
    ])

    const jobs = await buildPushJobs(db)

    expect(jobs).toHaveLength(2)
    expect(jobs[0]).toMatchObject({ userId: 'u1', channelId: 'ch-1', problemId: 10 })
    expect(jobs[1]).toMatchObject({ userId: 'u2', channelId: 'ch-2', problemId: 20 })
    expect(mockUpsertHistory).toHaveBeenCalledWith(db, [
      { userId: 'u1', problemId: 10 },
      { userId: 'u2', problemId: 20 },
    ])
    expect(mockStamp).toHaveBeenCalledWith(db, ['u1', 'u2'])
  })

  it('excludes LINE channel when line_push_allowed is false', async () => {
    const user = makeUser({ id: 'u1', line_push_allowed: false })

    mockGetBatch.mockResolvedValueOnce([user])
    mockSelectProblem.mockResolvedValueOnce(makeProblem())
    mockGetChannels.mockResolvedValueOnce([
      makeChannel({ id: 'ch-line', user_id: 'u1', channel_type: 'line', channel_identifier: 'U123' }),
      makeChannel({ id: 'ch-tg', user_id: 'u1', channel_type: 'telegram' }),
    ])

    const jobs = await buildPushJobs(db)

    expect(jobs).toHaveLength(1)
    expect(jobs[0].channelType).toBe('telegram')
    expect(mockUpsertHistory).toHaveBeenCalledWith(db, [{ userId: 'u1', problemId: 42 }])
  })

  it('skips user when no verified channels exist', async () => {
    mockGetBatch.mockResolvedValueOnce([makeUser({ id: 'u1' })])
    mockSelectProblem.mockResolvedValueOnce(makeProblem())
    mockGetChannels.mockResolvedValueOnce([])

    const jobs = await buildPushJobs(db)

    expect(jobs).toHaveLength(0)
    expect(mockGetChannels).toHaveBeenCalled()
    expect(mockUpsertHistory).not.toHaveBeenCalled()
    expect(mockStamp).not.toHaveBeenCalled()
  })

  it('skips user when no problem is found', async () => {
    mockGetBatch.mockResolvedValueOnce([makeUser({ id: 'u1' })])
    mockSelectProblem.mockResolvedValueOnce(null)

    const jobs = await buildPushJobs(db)

    expect(jobs).toHaveLength(0)
    expect(mockGetChannels).not.toHaveBeenCalled()
  })

  it('advances list positions for list-mode problems', async () => {
    mockGetBatch.mockResolvedValueOnce([makeUser({ id: 'u1', active_mode: 'list' })])
    mockSelectProblem.mockResolvedValueOnce(
      makeProblem({ list_id: 5, sequence_number: 3 }),
    )
    mockGetChannels.mockResolvedValueOnce([makeChannel({ user_id: 'u1' })])

    await buildPushJobs(db)

    expect(mockAdvance).toHaveBeenCalledWith(db, [
      { userId: 'u1', listId: 5, sequenceNumber: 3 },
    ])
  })

  it('paginates through multiple batches until a partial batch', async () => {
    const batch1 = Array.from({ length: 100 }, (_, i) => makeUser({ id: `u${i}` }))
    const batch2 = Array.from({ length: 30 }, (_, i) => makeUser({ id: `u${100 + i}` }))

    mockGetBatch
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
    mockSelectProblem.mockResolvedValue(makeProblem())
    mockGetChannels.mockImplementation(async (_db, userIds) =>
      userIds.map(uid => makeChannel({ user_id: uid, id: `ch-${uid}` })),
    )

    const jobs = await buildPushJobs(db)

    expect(jobs).toHaveLength(130)
    expect(mockGetBatch).toHaveBeenCalledTimes(2)
    expect(mockGetBatch).toHaveBeenCalledWith(db, 0, 100)
    expect(mockGetBatch).toHaveBeenCalledWith(db, 100, 100)
  })

  it('stops at MAX_BATCHES (100) safety limit', async () => {
    const fullBatch = Array.from({ length: 100 }, (_, i) => makeUser({ id: `u${i}` }))

    mockGetBatch.mockResolvedValue(fullBatch)
    mockSelectProblem.mockResolvedValue(makeProblem())
    mockGetChannels.mockImplementation(async (_db, userIds) =>
      userIds.map(uid => makeChannel({ user_id: uid, id: `ch-${uid}` })),
    )

    await buildPushJobs(db)

    expect(mockGetBatch).toHaveBeenCalledTimes(100)
  })
})
