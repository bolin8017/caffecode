import { describe, it, expect, vi } from 'vitest'
import { verifyChannelByToken, getChannelsForUser, deleteChannel, upsertChannel } from '../repositories/channel.repository.js'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Build a self-referencing Supabase chain mock (update/eq/gt/select/single). */
function makeChainMock(resolvedData: unknown, resolvedError: unknown = null) {
  const singleMock = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError })
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.update = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.gt = vi.fn().mockReturnValue(chain)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.single = singleMock

  const fromMock = vi.fn().mockReturnValue(chain)
  return { db: { from: fromMock } as unknown as SupabaseClient, fromMock, chain, singleMock }
}

describe('verifyChannelByToken', () => {
  it('returns user_id for valid unexpired token', async () => {
    const { db, fromMock, chain } = makeChainMock({ user_id: 'u-123' })

    const result = await verifyChannelByToken(db, 'tok-abc', 'chat-id-123')

    expect(result).toEqual({ user_id: 'u-123' })
    expect(fromMock).toHaveBeenCalledWith('notification_channels')
    expect(chain.update).toHaveBeenCalledWith({
      channel_identifier: 'chat-id-123',
      is_verified: true,
      link_token: null,
      link_token_expires_at: null,
    })
    expect(chain.eq).toHaveBeenCalledWith('link_token', 'tok-abc')
    expect(chain.eq).toHaveBeenCalledWith('is_verified', false)
    expect(chain.gt).toHaveBeenCalledWith('link_token_expires_at', expect.any(String))
  })

  it('returns null for expired token (no matching row)', async () => {
    const { db } = makeChainMock(null, { message: 'PGRST116' })

    const result = await verifyChannelByToken(db, 'expired-tok', 'chat-id')

    expect(result).toBeNull()
  })

  it('returns null on query error', async () => {
    const { db } = makeChainMock(null, { message: 'DB connection error' })

    const result = await verifyChannelByToken(db, 'tok', 'chat-id')

    expect(result).toBeNull()
  })

  it('filters by channel_type when provided', async () => {
    const { db, chain } = makeChainMock({ user_id: 'u-123' })

    await verifyChannelByToken(db, 'tok-abc', 'chat-id', 'telegram')

    expect(chain.eq).toHaveBeenCalledWith('channel_type', 'telegram')
  })

  it('does not filter by channel_type when not provided', async () => {
    const { db, chain } = makeChainMock({ user_id: 'u-123' })

    await verifyChannelByToken(db, 'tok-abc', 'chat-id')

    // eq is called for link_token and is_verified, but NOT for channel_type
    for (const call of chain.eq.mock.calls) {
      expect(call[0]).not.toBe('channel_type')
    }
  })
})

// ---------------------------------------------------------------------------
// upsertChannel
// ---------------------------------------------------------------------------
describe('upsertChannel', () => {
  it('upserts unverified channel with link token', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const data = {
      user_id: 'u-1',
      channel_type: 'telegram',
      channel_identifier: '',
      display_label: 'My Telegram',
      is_verified: false,
      link_token: 'tok-abc',
      link_token_expires_at: '2026-03-11T01:00:00Z',
    }

    await expect(upsertChannel(db, data)).resolves.toBeUndefined()
    expect(fromMock).toHaveBeenCalledWith('notification_channels')
    expect(upsertMock).toHaveBeenCalledWith(data, { onConflict: 'user_id,channel_type' })
  })

  it('upserts verified channel without link token', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const data = {
      user_id: 'u-2',
      channel_type: 'line',
      channel_identifier: 'line-uid-456',
      display_label: 'LINE Account',
      is_verified: true,
      link_token: null,
    }

    await expect(upsertChannel(db, data)).resolves.toBeUndefined()
    expect(upsertMock).toHaveBeenCalledWith(data, { onConflict: 'user_id,channel_type' })
  })

  it('passes onConflict as user_id,channel_type', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await upsertChannel(db, {
      user_id: 'u-3',
      channel_type: 'email',
      channel_identifier: 'a@b.com',
      display_label: null,
      is_verified: false,
      link_token: 'tok-xyz',
    })

    const options = upsertMock.mock.calls[0][1]
    expect(options).toEqual({ onConflict: 'user_id,channel_type' })
  })

  it('passes link_token and link_token_expires_at through', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const data = {
      user_id: 'u-4',
      channel_type: 'telegram',
      channel_identifier: '',
      display_label: null,
      is_verified: false,
      link_token: 'special-token',
      link_token_expires_at: '2026-12-31T23:59:59Z',
    }

    await upsertChannel(db, data)

    const passedData = upsertMock.mock.calls[0][0]
    expect(passedData.link_token).toBe('special-token')
    expect(passedData.link_token_expires_at).toBe('2026-12-31T23:59:59Z')
  })

  it('throws on Supabase error', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: { message: 'unique violation' } })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(
      upsertChannel(db, {
        user_id: 'u-5',
        channel_type: 'telegram',
        channel_identifier: 'chat-id',
        display_label: null,
        is_verified: false,
        link_token: null,
      })
    ).rejects.toThrow('Failed to upsert channel: unique violation')
  })

  it('handles null display_label', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const data = {
      user_id: 'u-6',
      channel_type: 'email',
      channel_identifier: 'test@example.com',
      display_label: null,
      is_verified: true,
      link_token: null,
    }

    await expect(upsertChannel(db, data)).resolves.toBeUndefined()
    expect(upsertMock.mock.calls[0][0].display_label).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getChannelsForUser
// ---------------------------------------------------------------------------
describe('getChannelsForUser', () => {
  const channels = [
    {
      id: 'ch-1',
      user_id: 'user-1',
      channel_type: 'telegram',
      display_label: 'My Telegram',
      is_verified: true,
      consecutive_send_failures: 0,
      connected_at: '2026-03-01T00:00:00Z',
    },
  ]

  it('returns channel list on success', async () => {
    // getChannelsForUser uses: from → select → eq → order (no .single)
    const orderMock = vi.fn().mockResolvedValue({ data: channels, error: null })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getChannelsForUser(db, 'user-1')
    expect(result).toEqual(channels)
  })

  it('returns empty array when no channels exist', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getChannelsForUser(db, 'user-1')
    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    const result = await getChannelsForUser(db, 'user-1')
    expect(result).toEqual([])
  })

  it('throws on DB error', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(getChannelsForUser(db, 'user-1')).rejects.toThrow('Failed to fetch channels: timeout')
  })
})

// ---------------------------------------------------------------------------
// deleteChannel
// ---------------------------------------------------------------------------
describe('deleteChannel', () => {
  it('resolves without error on success', async () => {
    // deleteChannel: from → delete → eq → eq (double eq for id + user_id)
    const eq2Mock = vi.fn().mockResolvedValue({ error: null })
    const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock })
    const deleteMock = vi.fn().mockReturnValue({ eq: eq1Mock })
    const fromMock = vi.fn().mockReturnValue({ delete: deleteMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(deleteChannel(db, 'ch-1', 'user-1')).resolves.toBeUndefined()
    expect(fromMock).toHaveBeenCalledWith('notification_channels')
    expect(eq1Mock).toHaveBeenCalledWith('id', 'ch-1')
    expect(eq2Mock).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('throws on DB error', async () => {
    const eq2Mock = vi.fn().mockResolvedValue({ error: { message: 'RLS denied' } })
    const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock })
    const deleteMock = vi.fn().mockReturnValue({ eq: eq1Mock })
    const fromMock = vi.fn().mockReturnValue({ delete: deleteMock })
    const db = { from: fromMock } as unknown as SupabaseClient

    await expect(deleteChannel(db, 'ch-1', 'user-1')).rejects.toThrow(
      'Failed to delete channel: RLS denied'
    )
  })
})
