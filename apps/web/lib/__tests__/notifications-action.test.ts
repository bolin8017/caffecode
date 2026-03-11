// apps/web/lib/__tests__/notifications-action.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/repositories/channel.repository', () => ({
  deleteChannel: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const mockSupabase = { from: vi.fn() }

import { getAuthUser } from '@/lib/auth'
import { deleteChannel } from '@/lib/repositories/channel.repository'
import { revalidatePath } from 'next/cache'

function setupAuth(userId = 'user-123') {
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: mockSupabase as unknown,
    user: { id: userId } as unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('disconnectChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    vi.mocked(deleteChannel).mockResolvedValue(undefined)
  })

  // ─── Happy path ───

  it('calls deleteChannel with correct channelId and userId', async () => {
    const { disconnectChannel } = await import('@/lib/actions/notifications')
    await disconnectChannel(VALID_UUID)

    expect(deleteChannel).toHaveBeenCalledWith(mockSupabase, VALID_UUID, 'user-123')
  })

  it('revalidates /settings after disconnect', async () => {
    const { disconnectChannel } = await import('@/lib/actions/notifications')
    await disconnectChannel(VALID_UUID)

    expect(revalidatePath).toHaveBeenCalledWith('/settings')
  })

  // ─── Zod validation ───

  it('throws ZodError for non-UUID channelId', async () => {
    const { disconnectChannel } = await import('@/lib/actions/notifications')
    await expect(disconnectChannel('not-a-uuid')).rejects.toThrow()
  })

  it('throws ZodError for empty string channelId', async () => {
    const { disconnectChannel } = await import('@/lib/actions/notifications')
    await expect(disconnectChannel('')).rejects.toThrow()
  })

  // ─── Error handling ───

  it('throws when deleteChannel fails', async () => {
    vi.mocked(deleteChannel).mockRejectedValue(new Error('delete failed'))

    const { disconnectChannel } = await import('@/lib/actions/notifications')
    await expect(disconnectChannel(VALID_UUID)).rejects.toThrow('通知管道中斷失敗')
  })

  // ─── Security ───

  it('passes the authenticated user own id to deleteChannel', async () => {
    setupAuth('my-user-id')

    const { disconnectChannel } = await import('@/lib/actions/notifications')
    await disconnectChannel(VALID_UUID)

    expect(deleteChannel).toHaveBeenCalledWith(
      expect.anything(),
      VALID_UUID,
      'my-user-id'
    )
  })
})
