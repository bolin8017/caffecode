import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getActiveListProgress,
  deactivateAllLists,
  upsertListProgress,
} from '@/lib/repositories/list.repository'

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
  const db = { from: fromMock } as unknown as SupabaseClient
  return { db, fromMock, chain, terminal }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getActiveListProgress
// ---------------------------------------------------------------------------
describe('getActiveListProgress', () => {
  const progressData = {
    current_position: 5,
    curated_lists: {
      id: 1,
      name: 'Blind 75',
      slug: 'blind-75',
      problem_count: 75,
    },
  }

  it('returns progress with joined curated_lists on success', async () => {
    const { db } = makeChainMock(progressData)
    const result = await getActiveListProgress(db, 'user-1')
    expect(result).toEqual(progressData)
  })

  it('returns null when no active list exists', async () => {
    const { db } = makeChainMock(null)
    const result = await getActiveListProgress(db, 'user-1')
    expect(result).toBeNull()
  })

  it('throws on DB error', async () => {
    const { db } = makeChainMock(null, { message: 'connection lost' })
    await expect(getActiveListProgress(db, 'user-1')).rejects.toThrow(
      'Failed to fetch active list progress: connection lost'
    )
  })

  it('filters by user_id and is_active=true', async () => {
    const { db, fromMock, chain } = makeChainMock(progressData)
    await getActiveListProgress(db, 'user-1')

    expect(fromMock).toHaveBeenCalledWith('user_list_progress')
    expect(chain.select).toHaveBeenCalledWith(
      'current_position, curated_lists(id, name, slug, problem_count)'
    )
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(chain.eq).toHaveBeenCalledWith('is_active', true)
  })
})

// ---------------------------------------------------------------------------
// deactivateAllLists
// ---------------------------------------------------------------------------
describe('deactivateAllLists', () => {
  it('resolves without error on success', async () => {
    // deactivateAllLists: from → update → eq (no terminal .single)
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(deactivateAllLists(db, 'user-1')).resolves.toBeUndefined()
  })

  it('calls from("user_list_progress").update({is_active: false}).eq("user_id", userId)', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await deactivateAllLists(db, 'user-1')

    expect(fromMock).toHaveBeenCalledWith('user_list_progress')
    expect(updateMock).toHaveBeenCalledWith({ is_active: false })
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('throws on DB error', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'RLS denied' } })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(deactivateAllLists(db, 'user-1')).rejects.toThrow(
      'Failed to deactivate lists: RLS denied'
    )
  })
})

// ---------------------------------------------------------------------------
// upsertListProgress
// ---------------------------------------------------------------------------
describe('upsertListProgress', () => {
  it('resolves without error on success', async () => {
    // upsertListProgress: from → upsert (no terminal .single)
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(
      upsertListProgress(db, { user_id: 'user-1', list_id: 3, is_active: true })
    ).resolves.toBeUndefined()
  })

  it('uses onConflict "user_id,list_id"', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const data = { user_id: 'user-1', list_id: 3, is_active: true, current_position: 0 }
    await upsertListProgress(db, data)

    expect(fromMock).toHaveBeenCalledWith('user_list_progress')
    expect(upsertMock).toHaveBeenCalledWith(data, { onConflict: 'user_id,list_id' })
  })

  it('throws on DB error', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: { message: 'unique violation' } })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(
      upsertListProgress(db, { user_id: 'user-1', list_id: 3, is_active: true })
    ).rejects.toThrow('Failed to upsert list progress: unique violation')
  })
})
