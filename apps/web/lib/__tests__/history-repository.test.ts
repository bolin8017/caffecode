import { describe, it, expect, vi } from 'vitest'
import { getSolvedProblemIds } from '@/lib/repositories/history.repository'

describe('getSolvedProblemIds', () => {
  it('returns a Set of solved problem IDs', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [{ problem_id: 1 }, { problem_id: 42 }],
          error: null,
        }),
      }),
    }
    const result = await getSolvedProblemIds(mockSupabase as any, 'user-123', [1, 2, 42])
    expect(result).toEqual(new Set([1, 42]))
  })

  it('returns empty Set when no problems solved', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }
    const result = await getSolvedProblemIds(mockSupabase as any, 'user-123', [1, 2])
    expect(result).toEqual(new Set())
  })

  it('returns empty Set when problemIds array is empty', async () => {
    const mockSupabase = { from: vi.fn() }
    const result = await getSolvedProblemIds(mockSupabase as any, 'user-123', [])
    expect(result).toEqual(new Set())
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('throws on Supabase error', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
      }),
    }
    await expect(getSolvedProblemIds(mockSupabase as any, 'user-123', [1])).rejects.toThrow('Failed to fetch solved problem IDs')
  })
})
