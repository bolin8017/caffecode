import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectProblemForUser } from '../../services/problem-selector.js'
import type { SupabaseClient } from '@supabase/supabase-js'

// A fluent mock that always returns itself until `.single()` or `.rpc()` is called
function makeQueryMock(resolvedData: unknown) {
  const single = vi.fn().mockResolvedValue({ data: resolvedData, error: null })
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = single
  return { chain, single }
}

describe('selectProblemForUser — list mode', () => {
  it('returns null when no active list progress', async () => {
    const { chain } = makeQueryMock(null) // null progress → returns null

    const mockSupabase = {
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient

    const result = await selectProblemForUser(
      { id: 'user-1', mode: 'list', difficulty_min: 0, difficulty_max: 3000 },
      mockSupabase
    )
    expect(result).toBeNull()
  })
})

describe('selectProblemForUser — list mode happy path', () => {
  it('returns problem at next list position with all fields', async () => {
    const progressData = { list_id: 5, current_position: 2 }
    const listProblemData = {
      problem_id: 42,
      sequence_number: 3,
      problems: {
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        leetcode_id: 1,
        problem_content: { explanation: 'Use a hash map.' },
      },
    }

    const { chain: progressChain } = makeQueryMock(progressData)
    const { chain: problemChain } = makeQueryMock(listProblemData)

    const mockSupabase = {
      from: vi.fn()
        .mockReturnValueOnce(progressChain)
        .mockReturnValueOnce(problemChain),
    } as unknown as SupabaseClient

    const result = await selectProblemForUser(
      { id: 'user-1', mode: 'list', difficulty_min: 0, difficulty_max: 3000 },
      mockSupabase,
    )

    expect(result).toEqual({
      problem_id: 42,
      leetcode_id: 1,
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      explanation: 'Use a hash map.',
      list_id: 5,
      sequence_number: 3,
    })
  })
})

describe('selectProblemForUser — filter mode', () => {
  it('returns null when no unsent problems available', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as SupabaseClient

    const result = await selectProblemForUser(
      { id: 'user-2', mode: 'filter', difficulty_min: 1300, difficulty_max: 1500 },
      mockSupabase
    )
    expect(result).toBeNull()
  })

  it('returns a problem selected from the unsent list', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    const rpcData = [{ problem_id: 10 }, { problem_id: 20 }, { problem_id: 30 }]
    const problemData = {
      id: 10,
      slug: 'valid-parentheses',
      title: 'Valid Parentheses',
      difficulty: 'Easy',
      leetcode_id: 20,
      problem_content: { explanation: 'Use a stack.' },
    }

    const { chain: problemChain } = makeQueryMock(problemData)

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
      from: vi.fn().mockReturnValue(problemChain),
    } as unknown as SupabaseClient

    const result = await selectProblemForUser(
      { id: 'user-2', mode: 'filter', difficulty_min: 1300, difficulty_max: 1500 },
      mockSupabase,
    )

    expect(result).toEqual({
      problem_id: 10,
      leetcode_id: 20,
      slug: 'valid-parentheses',
      title: 'Valid Parentheses',
      difficulty: 'Easy',
      explanation: 'Use a stack.',
    })
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_unsent_problem_ids_for_user', {
      p_user_id: 'user-2',
      p_diff_min: 1300,
      p_diff_max: 1500,
      p_topic: null,
    })

    randomSpy.mockRestore()
  })

  it('picks from unsent list using Math.random', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const rpcData = [{ problem_id: 10 }, { problem_id: 20 }, { problem_id: 30 }]
    // Math.floor(0.5 * 3) = 1 → picks problem_id: 20
    const problemData = {
      id: 20,
      slug: 'merge-sort',
      title: 'Merge Sort',
      difficulty: 'Medium',
      leetcode_id: 148,
      problem_content: { explanation: 'Divide and conquer.' },
    }

    const { chain: problemChain } = makeQueryMock(problemData)

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
      from: vi.fn().mockReturnValue(problemChain),
    } as unknown as SupabaseClient

    const result = await selectProblemForUser(
      { id: 'user-3', mode: 'filter', difficulty_min: 0, difficulty_max: 3000 },
      mockSupabase,
    )

    expect(result).toMatchObject({ problem_id: 20 })

    randomSpy.mockRestore()
  })
})
