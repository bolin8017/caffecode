import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Next.js server functions
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock getAuthUser
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

// Mock supabase client
const mockSingle = vi.fn()
const mockUpdateChain = {
  eq: vi.fn().mockReturnThis(),
}
// Make the update chain awaitable (resolves to { error: null })
Object.assign(mockUpdateChain, {
  then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
})
const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: mockSingle,
  update: vi.fn().mockReturnValue(mockUpdateChain),
}
const mockFrom = vi.fn().mockReturnValue(mockChain)
const mockSupabase = { from: mockFrom }

import { getAuthUser } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: mockSupabase as any,
    user: { id: 'user-123' } as any,
  })
})

describe('markSolved', () => {
  it('throws if history row does not exist for this user+problem', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null }) // history: not found
    const { markSolved } = await import('@/lib/actions/history')
    await expect(markSolved(42)).rejects.toThrow('未找到推送記錄')
  })

  it('throws if feedback does not exist for this user+problem', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: 1, sent_at: new Date().toISOString() }, error: null }) // history found
      .mockResolvedValueOnce({ data: null, error: null }) // feedback: not found
    const { markSolved } = await import('@/lib/actions/history')
    await expect(markSolved(42)).rejects.toThrow('請先送出題目評分')
  })

  it('succeeds when both history and feedback exist', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: 1, sent_at: new Date().toISOString(), solved_at: null }, error: null })
      .mockResolvedValueOnce({ data: { id: 5 }, error: null })
    const { markSolved } = await import('@/lib/actions/history')
    await expect(markSolved(42)).resolves.toBeUndefined()
  })
})
