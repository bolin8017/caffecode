import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getRecentHistory, getSolvedProblemIds } from '@/lib/repositories/history.repository'

describe('getRecentHistory', () => {
  it('returns entries with problem_id and solved_at', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              problem_id: 1,
              sent_at: '2026-03-07T10:00:00Z',
              solved_at: '2026-03-07T11:00:00Z',
              problems: { title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy' },
            },
            {
              problem_id: 2,
              sent_at: '2026-03-06T10:00:00Z',
              solved_at: null,
              problems: { title: 'Add Two Numbers', slug: 'add-two-numbers', difficulty: 'Medium' },
            },
          ],
          error: null,
        }),
      }),
    }
    const result = await getRecentHistory(mockSupabase as unknown as SupabaseClient, 'user-123', 7)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ problem_id: 1, solved_at: expect.any(String) })
    expect(result[1]).toMatchObject({ problem_id: 2, solved_at: null })
  })

  it('throws on Supabase error', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } }),
      }),
    }
    await expect(getRecentHistory(mockSupabase as unknown as SupabaseClient, 'user-123', 7))
      .rejects.toThrow('Failed to fetch recent history')
  })
})

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
    const result = await getSolvedProblemIds(mockSupabase as unknown as SupabaseClient, 'user-123', [1, 2, 42])
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
    const result = await getSolvedProblemIds(mockSupabase as unknown as SupabaseClient, 'user-123', [1, 2])
    expect(result).toEqual(new Set())
  })

  it('returns empty Set when problemIds array is empty', async () => {
    const mockSupabase = { from: vi.fn() }
    const result = await getSolvedProblemIds(mockSupabase as unknown as SupabaseClient, 'user-123', [])
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
    await expect(getSolvedProblemIds(mockSupabase as unknown as SupabaseClient, 'user-123', [1])).rejects.toThrow('Failed to fetch solved problem IDs')
  })
})
