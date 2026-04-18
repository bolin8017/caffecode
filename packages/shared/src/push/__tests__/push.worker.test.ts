import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LimitFunction } from 'p-limit'

import { buildPushJobs, dispatchJob, type PushJobData } from '../push.logic.js'
import { recordPushRun } from '../push.repository.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationChannel } from '../channels/registry.js'

const noopLimit = vi.fn((fn: () => unknown) => fn()) as unknown as LimitFunction

// Test the pure logic of building push jobs — decoupled from BullMQ
describe('buildPushJobs', () => {
  beforeEach(() => {
    process.env.APP_URL = 'https://caffecode.net'
  })

  it('returns zero stats when no users due for push', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as SupabaseClient

    const stats = await buildPushJobs(mockSupabase, {}, noopLimit)
    expect(stats).toEqual({ totalCandidates: 0, succeeded: 0, failed: 0 })
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
  beforeEach(() => {
    process.env.APP_URL = 'https://caffecode.net'
  })

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
    const channel: NotificationChannel = vi.fn().mockResolvedValue({
      success: false, shouldRetry: false, error: '403 Forbidden',
    })

    await dispatchJob(makeJob(), channel, mock)

    expect(rpcMock).toHaveBeenCalledWith('increment_channel_failures', { p_channel_id: 'ch-1' })
  })

  it('does not reset failure counter per-channel on successful send (bulk reset handles this)', async () => {
    const { mock, fromMock, rpcMock } = makeSupabaseMock()
    const channel: NotificationChannel = vi.fn().mockResolvedValue({ success: true })

    await dispatchJob(makeJob(), channel, mock)

    // dispatchJob no longer resets per-channel — bulk resetChannelFailures in buildPushJobs handles it
    expect(fromMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('does not modify failure counter on retryable failure', async () => {
    const fromMock = vi.fn()
    const rpcMock = vi.fn()
    const mock = { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient
    const channel: NotificationChannel = vi.fn().mockResolvedValue({
      success: false, shouldRetry: true, error: '500 Server Error',
    })

    await dispatchJob(makeJob(), channel, mock)

    expect(fromMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  // P3-6 circuit-breaker edge cases

  it('retryable failure does NOT call incrementChannelFailures', async () => {
    const { mock, rpcMock } = makeSupabaseMock()
    const channel: NotificationChannel = vi.fn().mockResolvedValue({
      success: false, shouldRetry: true, error: '429 Too Many Requests',
    })

    await dispatchJob(makeJob(), channel, mock)

    const incrementCalls = rpcMock.mock.calls.filter(
      ([name]) => name === 'increment_channel_failures'
    )
    expect(incrementCalls).toHaveLength(0)
  })

  it('successful send after prior failures does not reset per-channel (bulk reset handles this)', async () => {
    const { mock, fromMock, rpcMock } = makeSupabaseMock()
    const job = makeJob()

    // Simulate successful send — per-channel reset removed; bulk resetChannelFailures in buildPushJobs handles it
    const channel: NotificationChannel = vi.fn().mockResolvedValue({ success: true })

    await dispatchJob(job, channel, mock)

    expect(fromMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('three sequential permanent failures each call incrementChannelFailures once', async () => {
    const { mock, rpcMock } = makeSupabaseMock()
    const channel: NotificationChannel = vi.fn().mockResolvedValue({
      success: false, shouldRetry: false, error: '403 Forbidden',
    })

    await dispatchJob(makeJob(), channel, mock)
    await dispatchJob(makeJob(), channel, mock)
    await dispatchJob(makeJob(), channel, mock)

    const incrementCalls = rpcMock.mock.calls.filter(
      ([name]) => name === 'increment_channel_failures'
    )
    expect(incrementCalls).toHaveLength(3)
    for (const [, params] of incrementCalls) {
      expect(params).toEqual({ p_channel_id: 'ch-1' })
    }
  })

  it('retryable failure then permanent failure increments counter exactly once', async () => {
    const { mock, rpcMock } = makeSupabaseMock()
    const channel: NotificationChannel = vi.fn()
      .mockResolvedValueOnce({ success: false, shouldRetry: true, error: '503 Service Unavailable' })
      .mockResolvedValueOnce({ success: false, shouldRetry: false, error: '403 Forbidden' })

    await dispatchJob(makeJob(), channel, mock)   // retryable — no increment
    await dispatchJob(makeJob(), channel, mock)   // permanent — increment once

    const incrementCalls = rpcMock.mock.calls.filter(
      ([name]) => name === 'increment_channel_failures'
    )
    expect(incrementCalls).toHaveLength(1)
    expect(incrementCalls[0][1]).toEqual({ p_channel_id: 'ch-1' })
  })
})
