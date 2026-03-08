import { describe, it, expect, vi } from 'vitest'

// Mock config before importing modules that depend on it
vi.mock('../lib/config.js', () => ({
  config: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    TELEGRAM_BOT_TOKEN: 'test-token',
    LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
    APP_URL: 'https://caffecode.net',
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'CaffeCode <noreply@caffecode.net>',
  },
}))

import { buildPushJobs, dispatchJob, type PushJobData } from '../workers/push.logic.js'
import { recordPushRun } from '../repositories/push.repository.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationChannel } from '../channels/interface.js'

// Test the pure logic of building push jobs — decoupled from BullMQ
describe('buildPushJobs', () => {
  it('returns empty array when no users due for push', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient

    const jobs = await buildPushJobs(mockSupabase)
    expect(jobs).toHaveLength(0)
  })
})

describe('recordPushRun', () => {
  it('inserts a row into push_runs with correct fields', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const mockSupabase = {
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    } as unknown as SupabaseClient

    await recordPushRun(mockSupabase, {
      candidates: 10,
      succeeded: 9,
      failed: 1,
      durationMs: 2500,
    })

    expect(mockSupabase.from).toHaveBeenCalledWith('push_runs')
    expect(insertMock).toHaveBeenCalledWith({
      candidates: 10,
      succeeded: 9,
      failed: 1,
      duration_ms: 2500,
      error_msg: null,
    })
  })

  it('records error_msg when provided', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const mockSupabase = {
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    } as unknown as SupabaseClient

    await recordPushRun(mockSupabase, {
      candidates: 0,
      succeeded: 0,
      failed: 0,
      durationMs: 100,
      errorMsg: 'Redis connection failed',
    })

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ error_msg: 'Redis connection failed', duration_ms: 100 })
    )
  })
})

describe('dispatchJob', () => {
  const makeJob = (): PushJobData => ({
    userId: 'user-1',
    channelId: 'ch-1',
    channelType: 'telegram',
    channelIdentifier: '123456',
    problemId: 42,
    title: 'Two Sum',
    difficulty: 'Easy',
    leetcodeId: 1,
    explanation: 'Use a hash map.',
    problemSlug: 'two-sum',
  })

  function makeSupabaseMock() {
    const gtMock = vi.fn().mockResolvedValue({ error: null })
    const eqMock = vi.fn().mockReturnValue({ gt: gtMock })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({
      update: updateMock,
    })
    const rpcMock = vi.fn().mockResolvedValue({ error: null })
    return { mock: { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient, fromMock, updateMock, rpcMock }
  }

  it('increments failure counter via RPC on permanent send failure', async () => {
    const { mock, rpcMock } = makeSupabaseMock()
    const channel: NotificationChannel = {

      send: vi.fn().mockResolvedValue({ success: false, shouldRetry: false, error: '403 Forbidden' }),
    }

    await dispatchJob(makeJob(), channel, mock)

    expect(rpcMock).toHaveBeenCalledWith('increment_channel_failures', { p_channel_id: 'ch-1' })
  })

  it('resets failure counter on successful send', async () => {
    const { mock, fromMock, updateMock } = makeSupabaseMock()
    const channel: NotificationChannel = {

      send: vi.fn().mockResolvedValue({ success: true }),
    }

    await dispatchJob(makeJob(), channel, mock)

    expect(fromMock).toHaveBeenCalledWith('notification_channels')
    expect(updateMock).toHaveBeenCalledWith({ consecutive_send_failures: 0 })
  })

  it('does not modify failure counter on retryable failure', async () => {
    const fromMock = vi.fn()
    const rpcMock = vi.fn()
    const mock = { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient
    const channel: NotificationChannel = {

      send: vi.fn().mockResolvedValue({ success: false, shouldRetry: true, error: '500 Server Error' }),
    }

    await dispatchJob(makeJob(), channel, mock)

    expect(fromMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
