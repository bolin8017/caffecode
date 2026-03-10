// apps/worker/src/__tests__/push.pipeline.paused.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LimitFunction } from 'p-limit'
import type { NotificationChannel } from '../channels/interface.js'
import type { SendResult } from '@caffecode/shared'

// Mock config
vi.mock('../lib/config.js', () => ({
  config: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    TELEGRAM_BOT_TOKEN: 'test-token',
    LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
    APP_URL: 'https://caffecode.net',
  },
}))

// Mock selectProblemForUser to return a problem for each candidate
vi.mock('@caffecode/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@caffecode/shared')>()
  return {
    ...actual,
    selectProblemForUser: vi.fn().mockResolvedValue({
      problem_id: 42,
      leetcode_id: 1,
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      explanation: 'Use a hash map.',
    }),
  }
})

import { buildPushJobs } from '../workers/push.logic.js'

const noopLimit: LimitFunction = Object.assign(
  (fn: () => unknown) => Promise.resolve(fn()),
  { activeCount: 0, pendingCount: 0, concurrency: 1, clearQueue: vi.fn() },
) as unknown as LimitFunction

function makeCandidate(id: string) {
  return {
    id,
    timezone: 'Asia/Taipei',
    active_mode: 'filter' as const,
    difficulty_min: 0,
    difficulty_max: 3000,
    topic_filter: null,
    line_push_allowed: true,
  }
}

function makeSupabaseMock(candidates: ReturnType<typeof makeCandidate>[]) {
  // getAllCandidates RPC
  const rpcMock = vi.fn()
    .mockImplementation((name: string) => {
      if (name === 'get_push_candidates') {
        return Promise.resolve({ data: candidates, error: null })
      }
      // stamp_last_push_date, advance_list_positions, increment_channel_failures
      return Promise.resolve({ data: null, error: null })
    })

  // getVerifiedChannelsBulk chain + upsertHistoryBatch + resetChannelFailuresForUsers
  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'notification_channels') {
      // For getVerifiedChannelsBulk: return channels for each user
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: candidates.map((c, i) => ({
                  id: `ch-${i}`,
                  user_id: c.id,
                  channel_type: 'telegram',
                  channel_identifier: `chat-${i}`,
                })),
                error: null,
              }),
            }),
          }),
        }),
        // For resetChannelFailuresForUsers
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            gt: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }
    }
    if (table === 'history') {
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }
    }
    return {
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
  })

  return { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient
}

describe('buildPushJobs — channel pausing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pauses channel after permanent failure (shouldRetry=false) for subsequent jobs', async () => {
    const users = [makeCandidate('user-1'), makeCandidate('user-2')]
    const db = makeSupabaseMock(users)

    // First call: permanent failure. Second call: should be skipped (paused)
    let callCount = 0
    const channel: NotificationChannel = {
      send: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return { success: false, shouldRetry: false, error: '403 Forbidden' } as SendResult
        }
        // This should not be reached if pausing works
        return { success: true, shouldRetry: false } as SendResult
      }),
    }

    // Both users share the same channel ID by making the mock return same channel_id
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'notification_channels') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({
                  data: users.map(c => ({
                    id: 'ch-shared', // Same channel ID for both users
                    user_id: c.id,
                    channel_type: 'telegram',
                    channel_identifier: 'chat-shared',
                  })),
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }
      }
      if (table === 'history') {
        return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })

    const dbWithSharedChannel = {
      from: fromMock,
      rpc: (db as { rpc: unknown }).rpc,
    } as unknown as SupabaseClient

    const stats = await buildPushJobs(
      dbWithSharedChannel,
      { telegram: channel },
      noopLimit,
    )

    // First send fails permanently, second job for same channel is paused
    expect(stats.failed).toBeGreaterThanOrEqual(1)
  })

  it('does NOT pause on retryable failure (shouldRetry=true)', async () => {
    const users = [makeCandidate('user-1')]
    const db = makeSupabaseMock(users)

    const channel: NotificationChannel = {
      send: vi.fn().mockResolvedValue({
        success: false,
        shouldRetry: true,
        error: '500 Server Error',
      } as SendResult),
    }

    const stats = await buildPushJobs(db, { telegram: channel }, noopLimit)

    // Job fails but channel should NOT be paused (shouldRetry=true)
    expect(stats.failed).toBe(1)
    // channel.send should have been called (not skipped)
    expect(channel.send).toHaveBeenCalled()
  })

  it('pausing one channel does not affect other channels for the same user', async () => {
    const users = [makeCandidate('user-1')]

    // Return two channels for the user: telegram + line
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'notification_channels') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'ch-tg', user_id: 'user-1', channel_type: 'telegram', channel_identifier: 'chat-1' },
                    { id: 'ch-line', user_id: 'user-1', channel_type: 'line', channel_identifier: 'line-1' },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }
      }
      if (table === 'history') {
        return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })

    const rpcMock = vi.fn().mockResolvedValue({ data: users, error: null })

    const db = { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient

    const telegramChannel: NotificationChannel = {
      send: vi.fn().mockResolvedValue({
        success: false,
        shouldRetry: false,
        error: '403 Forbidden',
      } as SendResult),
    }
    const lineChannel: NotificationChannel = {
      send: vi.fn().mockResolvedValue({
        success: true,
        shouldRetry: false,
      } as SendResult),
    }

    const stats = await buildPushJobs(
      db,
      { telegram: telegramChannel, line: lineChannel },
      noopLimit,
    )

    // Telegram failed permanently, but LINE should still succeed
    expect(lineChannel.send).toHaveBeenCalled()
    expect(stats.succeeded).toBeGreaterThanOrEqual(1)
  })
})
