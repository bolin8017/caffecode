import { describe, it, expect, vi } from 'vitest'
import { verifyChannelByToken } from '../repositories/channel.repository.js'
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
})
