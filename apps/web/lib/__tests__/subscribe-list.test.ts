import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})
const mockFrom = vi.fn().mockReturnValue({
  upsert: mockUpsert,
  update: mockUpdate,
})
const mockSupabase = { from: mockFrom }

import { getAuthUser } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: mockSupabase as unknown,
    user: { id: 'user-123' } as unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
})

describe('subscribeToList', () => {
  it('subscribes without startPosition (preserves existing position)', async () => {
    const { subscribeToList } = await import('@/lib/actions/settings')
    await subscribeToList(5)

    // Should upsert WITHOUT current_position
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ current_position: expect.anything() }),
      expect.anything()
    )
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', list_id: 5, is_active: true }),
      expect.anything()
    )
  })

  it('subscribes with startPosition', async () => {
    const { subscribeToList } = await import('@/lib/actions/settings')
    await subscribeToList(5, 10)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ current_position: 10 }),
      expect.anything()
    )
  })

  it('rejects negative startPosition', async () => {
    const { subscribeToList } = await import('@/lib/actions/settings')
    await expect(subscribeToList(5, -1)).rejects.toThrow()
  })

  it('rejects non-integer listId', async () => {
    const { subscribeToList } = await import('@/lib/actions/settings')
    await expect(subscribeToList(1.5)).rejects.toThrow()
  })
})
