import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getListProblemAtPosition,
  getProblemAtListPosition,
  getUnsentProblemIds,
  getProblemById,
} from '../repositories/problem.repository.js'

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
  const rpcMock = vi.fn().mockResolvedValue({ data, error })
  const db = { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient
  return { db, fromMock, rpcMock, chain, terminal }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getListProblemAtPosition
// ---------------------------------------------------------------------------
describe('getListProblemAtPosition', () => {
  it('returns list_id and current_position on success', async () => {
    const { db } = makeChainMock({ list_id: 7, current_position: 3 })
    const result = await getListProblemAtPosition(db, 'user-1')
    expect(result).toEqual({ list_id: 7, current_position: 3 })
  })

  it('returns null on DB error', async () => {
    const { db } = makeChainMock(null, { message: 'PGRST116' })
    const result = await getListProblemAtPosition(db, 'user-1')
    expect(result).toBeNull()
  })

  it('returns null when data is null', async () => {
    const { db } = makeChainMock(null)
    const result = await getListProblemAtPosition(db, 'user-1')
    expect(result).toBeNull()
  })

  it('filters by user_id and is_active=true', async () => {
    const { db, fromMock, chain } = makeChainMock({ list_id: 7, current_position: 0 })
    await getListProblemAtPosition(db, 'user-1')

    expect(fromMock).toHaveBeenCalledWith('user_list_progress')
    expect(chain.select).toHaveBeenCalledWith('list_id, current_position')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(chain.eq).toHaveBeenCalledWith('is_active', true)
  })
})

// ---------------------------------------------------------------------------
// getProblemAtListPosition
// ---------------------------------------------------------------------------
describe('getProblemAtListPosition', () => {
  const listProblemData = {
    problem_id: 42,
    sequence_number: 4,
    problems: {
      slug: 'trapping-rain-water',
      title: 'Trapping Rain Water',
      difficulty: 'Hard',
      leetcode_id: 42,
      problem_content: { explanation: 'Use two-pointer approach.' },
    },
  }

  it('returns SelectedProblem with full metadata on success', async () => {
    const { db } = makeChainMock(listProblemData)
    const result = await getProblemAtListPosition(db, 7, 3)
    expect(result).toEqual({
      problem_id: 42,
      leetcode_id: 42,
      slug: 'trapping-rain-water',
      title: 'Trapping Rain Water',
      difficulty: 'Hard',
      explanation: 'Use two-pointer approach.',
      list_id: 7,
      sequence_number: 4, // currentPosition (3) + 1
    })
  })

  it('queries with nextSeq = currentPosition + 1', async () => {
    const { db, chain } = makeChainMock(listProblemData)
    await getProblemAtListPosition(db, 7, 3)
    // nextSeq = 3 + 1 = 4
    expect(chain.eq).toHaveBeenCalledWith('sequence_number', 4)
    expect(chain.eq).toHaveBeenCalledWith('list_id', 7)
  })

  it('returns null when no data', async () => {
    const { db } = makeChainMock(null, { message: 'no rows' })
    const result = await getProblemAtListPosition(db, 7, 75)
    expect(result).toBeNull()
  })

  it('returns null when problem_content is missing', async () => {
    const noProblemContent = {
      ...listProblemData,
      problems: {
        ...listProblemData.problems,
        problem_content: null,
      },
    }
    const { db } = makeChainMock(noProblemContent)
    const result = await getProblemAtListPosition(db, 7, 3)
    expect(result).toBeNull()
  })

  it('handles position=0 boundary (nextSeq=1)', async () => {
    const { db, chain } = makeChainMock(listProblemData)
    await getProblemAtListPosition(db, 7, 0)
    expect(chain.eq).toHaveBeenCalledWith('sequence_number', 1)
  })
})

// ---------------------------------------------------------------------------
// getUnsentProblemIds
// ---------------------------------------------------------------------------
describe('getUnsentProblemIds', () => {
  it('returns array of problem IDs on success', async () => {
    const rpcData = [{ problem_id: 1 }, { problem_id: 42 }, { problem_id: 100 }]
    const { db } = makeChainMock(rpcData)
    const result = await getUnsentProblemIds(db, 'user-1', 1000, 2000, ['array'])
    expect(result).toEqual([1, 42, 100])
  })

  it('returns empty array when data is null', async () => {
    const { db } = makeChainMock(null)
    const result = await getUnsentProblemIds(db, 'user-1', 1000, 2000, null)
    expect(result).toEqual([])
  })

  it('throws on RPC error', async () => {
    const { db } = makeChainMock(null, { message: 'connection refused' })
    await expect(
      getUnsentProblemIds(db, 'user-1', 1000, 2000, null)
    ).rejects.toThrow('getUnsentProblemIds: RPC failed: connection refused')
  })

  it('passes all params correctly to RPC', async () => {
    const { db, rpcMock } = makeChainMock([])
    await getUnsentProblemIds(db, 'user-1', 1200, 1800, ['array', 'string'])

    expect(rpcMock).toHaveBeenCalledWith('get_unsent_problem_ids_for_user', {
      p_user_id: 'user-1',
      p_diff_min: 1200,
      p_diff_max: 1800,
      p_topic: ['array', 'string'],
    })
  })

  it('passes null topic_filter correctly', async () => {
    const { db, rpcMock } = makeChainMock([])
    await getUnsentProblemIds(db, 'user-1', 0, 3000, null)

    expect(rpcMock).toHaveBeenCalledWith('get_unsent_problem_ids_for_user', {
      p_user_id: 'user-1',
      p_diff_min: 0,
      p_diff_max: 3000,
      p_topic: null,
    })
  })
})

// ---------------------------------------------------------------------------
// getProblemById
// ---------------------------------------------------------------------------
describe('getProblemById', () => {
  const problemData = {
    id: 42,
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    leetcode_id: 42,
    problem_content: { explanation: 'Use two-pointer approach.' },
  }

  it('returns SelectedProblem with content on success', async () => {
    const { db } = makeChainMock(problemData)
    const result = await getProblemById(db, 42)
    expect(result).toEqual({
      problem_id: 42,
      leetcode_id: 42,
      slug: 'trapping-rain-water',
      title: 'Trapping Rain Water',
      difficulty: 'Hard',
      explanation: 'Use two-pointer approach.',
    })
  })

  it('returns null when no data', async () => {
    const { db } = makeChainMock(null, { message: 'PGRST116' })
    const result = await getProblemById(db, 999)
    expect(result).toBeNull()
  })

  it('returns null when problem_content is null', async () => {
    const noContent = { ...problemData, problem_content: null }
    const { db } = makeChainMock(noContent)
    const result = await getProblemById(db, 42)
    expect(result).toBeNull()
  })

  it('returns null when row itself is null (no error)', async () => {
    const { db } = makeChainMock(null)
    const result = await getProblemById(db, 42)
    expect(result).toBeNull()
  })

  it('queries from("problems") with eq("id", problemId)', async () => {
    const { db, fromMock, chain } = makeChainMock(problemData)
    await getProblemById(db, 42)

    expect(fromMock).toHaveBeenCalledWith('problems')
    expect(chain.select).toHaveBeenCalledWith(
      'id, slug, title, difficulty, leetcode_id, problem_content(explanation)'
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 42)
  })
})
