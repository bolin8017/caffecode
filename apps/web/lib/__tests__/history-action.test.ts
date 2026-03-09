import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Next.js server functions
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock getAuthUser
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// Mock supabase client
const mockSingle = vi.fn()
const mockUpdateSelect = {
  then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: 1 }], error: null }).then(resolve),
}
const mockUpdateChain = {
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnValue(mockUpdateSelect),
}
const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  single: mockSingle,
  update: vi.fn().mockReturnValue(mockUpdateChain),
}
const mockFrom = vi.fn().mockReturnValue(mockChain)
const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null })
const mockSupabase = { from: mockFrom, rpc: mockRpc }

import { getAuthUser } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: mockSupabase as unknown,
    user: { id: 'user-123' } as unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
})

describe('markSolved', () => {
  it('throws if history row does not exist for this user+problem', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
    const { markSolved } = await import('@/lib/actions/history')
    await expect(markSolved(42)).rejects.toThrow('No push record found')
  })

  it('succeeds when history exists', async () => {
    mockSingle
      .mockResolvedValueOnce({
        data: {
          id: 1,
          sent_at: new Date().toISOString(),
          solved_at: null,
          problems: { topics: ['array'] },
        },
        error: null,
      })
    const { markSolved } = await import('@/lib/actions/history')
    const result = await markSolved(42)
    expect(result).toBeDefined()
    expect(result).toHaveProperty('levelUps')
    expect(result).toHaveProperty('newBadges')
    expect(result).toHaveProperty('topicProgress')
    expect(result).toHaveProperty('firstSolve')
  })
})
