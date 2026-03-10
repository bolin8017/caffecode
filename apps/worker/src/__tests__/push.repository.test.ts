import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getVerifiedChannelsBulk,
  stampLastPushDate,
  advanceListPositions,
  upsertHistoryBatch,
  incrementChannelFailures,
  getAllCandidates,
} from '../repositories/push.repository.js'

describe('getVerifiedChannelsBulk', () => {
  it('queries verified channels excluding those with >= 3 failures', async () => {
    const ltMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqMock = vi.fn().mockReturnValue({ lt: ltMock })
    const inMock = vi.fn().mockReturnValue({ eq: eqMock })
    const selectMock = vi.fn().mockReturnValue({ in: inMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await getVerifiedChannelsBulk(db, ['user-1', 'user-2'])

    expect(fromMock).toHaveBeenCalledWith('notification_channels')
    expect(selectMock).toHaveBeenCalledWith('id, user_id, channel_type, channel_identifier')
    expect(inMock).toHaveBeenCalledWith('user_id', ['user-1', 'user-2'])
    expect(eqMock).toHaveBeenCalledWith('is_verified', true)
    expect(ltMock).toHaveBeenCalledWith('consecutive_send_failures', 3)
  })
})

describe('stampLastPushDate', () => {
  it('calls stamp_last_push_date RPC with user IDs', async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null })
    const db = { rpc: rpcMock } as unknown as SupabaseClient

    await stampLastPushDate(db, ['user-1', 'user-2'])

    expect(rpcMock).toHaveBeenCalledWith('stamp_last_push_date', {
      p_user_ids: ['user-1', 'user-2'],
    })
  })
})

describe('advanceListPositions', () => {
  it('transforms camelCase to snake_case and calls RPC', async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null })
    const db = { rpc: rpcMock } as unknown as SupabaseClient

    await advanceListPositions(db, [
      { userId: 'u1', listId: 5, sequenceNumber: 3 },
      { userId: 'u2', listId: 7, sequenceNumber: 10 },
    ])

    expect(rpcMock).toHaveBeenCalledWith('advance_list_positions', {
      p_updates: [
        { user_id: 'u1', list_id: 5, sequence_number: 3 },
        { user_id: 'u2', list_id: 7, sequence_number: 10 },
      ],
    })
  })

  it('returns early without calling RPC for empty updates', async () => {
    const rpcMock = vi.fn()
    const db = { rpc: rpcMock } as unknown as SupabaseClient

    await advanceListPositions(db, [])

    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('upsertHistoryBatch', () => {
  it('upserts with onConflict and ignoreDuplicates', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await upsertHistoryBatch(db, [
      { userId: 'u1', problemId: 42 },
      { userId: 'u2', problemId: 99 },
    ])

    expect(fromMock).toHaveBeenCalledWith('history')
    expect(upsertMock).toHaveBeenCalledWith(
      [
        { user_id: 'u1', problem_id: 42 },
        { user_id: 'u2', problem_id: 99 },
      ],
      { onConflict: 'user_id,problem_id', ignoreDuplicates: true },
    )
  })
})

describe('incrementChannelFailures', () => {
  it('calls increment_channel_failures RPC with channel ID', async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null })
    const db = { rpc: rpcMock } as unknown as SupabaseClient

    await incrementChannelFailures(db, 'ch-42')

    expect(rpcMock).toHaveBeenCalledWith('increment_channel_failures', {
      p_channel_id: 'ch-42',
    })
  })
})

describe('getAllCandidates', () => {
  it('calls get_push_candidates RPC and returns all rows', async () => {
    const mockRow = {
      id: 'user-1',
      timezone: 'Asia/Taipei',
      active_mode: 'list',
      difficulty_min: 0,
      difficulty_max: 3000,
      topic_filter: null,
      line_push_allowed: true,
    }
    const rpcMock = vi.fn().mockResolvedValue({ data: [mockRow], error: null })
    const db = { rpc: rpcMock } as unknown as SupabaseClient

    const result = await getAllCandidates(db)

    expect(rpcMock).toHaveBeenCalledWith('get_push_candidates')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'user-1' })
  })

  it('throws on RPC error', async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const db = { rpc: rpcMock } as unknown as SupabaseClient

    await expect(getAllCandidates(db)).rejects.toThrow('getAllCandidates: RPC failed: DB error')
  })
})
