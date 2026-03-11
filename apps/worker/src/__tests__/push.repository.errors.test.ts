// apps/worker/src/__tests__/push.repository.errors.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getVerifiedChannelsBulk,
  incrementChannelFailures,
  resetChannelFailuresForUsers,
  recordPushRun,
  upsertHistoryBatch,
  stampLastPushDate,
} from '../repositories/push.repository.js'

describe('getVerifiedChannelsBulk — error handling', () => {
  it('returns empty array on DB error (non-throwing)', async () => {
    const ltMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    })
    const eqMock = vi.fn().mockReturnValue({ lt: ltMock })
    const inMock = vi.fn().mockReturnValue({ eq: eqMock })
    const selectMock = vi.fn().mockReturnValue({ in: inMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getVerifiedChannelsBulk(db, ['user-1'])

    // Should return [] instead of throwing
    expect(result).toEqual([])
  })
})

describe('incrementChannelFailures — error handling', () => {
  it('does not throw on DB error (logs only)', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      error: { message: 'function not found' },
    })
    const db = { rpc: rpcMock } as unknown as SupabaseClient

    // Should not throw — logs error internally
    await expect(incrementChannelFailures(db, 'ch-1')).resolves.toBeUndefined()
  })
})

describe('resetChannelFailuresForUsers — error handling', () => {
  it('does not throw on DB error (logs only)', async () => {
    const gtMock = vi.fn().mockResolvedValue({
      error: { message: 'timeout' },
    })
    const inMock = vi.fn().mockReturnValue({ gt: gtMock })
    const updateMock = vi.fn().mockReturnValue({ in: inMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    // Should not throw — logs error internally
    await expect(
      resetChannelFailuresForUsers(db, ['user-1']),
    ).resolves.toBeUndefined()
  })
})

describe('recordPushRun — error handling', () => {
  it('does not throw on DB error (logs only)', async () => {
    const insertMock = vi.fn().mockResolvedValue({
      error: { message: 'disk full' },
    })
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    // Should not throw — logs error internally
    await expect(
      recordPushRun(db, {
        candidates: 10,
        succeeded: 5,
        failed: 5,
        durationMs: 1000,
      }),
    ).resolves.toBeUndefined()
  })
})

describe('upsertHistoryBatch — error handling', () => {
  it('skips insert when entries array is empty', async () => {
    const fromMock = vi.fn()
    const db = { from: fromMock } as unknown as SupabaseClient

    await upsertHistoryBatch(db, [])

    // Should return early without calling from()
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('stampLastPushDate — error handling', () => {
  it('DOES throw on DB error (critical operation)', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'RPC failed: function error' },
    })
    const db = { rpc: rpcMock } as unknown as SupabaseClient

    await expect(stampLastPushDate(db, ['user-1'])).rejects.toThrow(
      'stampLastPushDate: RPC failed',
    )
  })
})
