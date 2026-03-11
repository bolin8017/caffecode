import { describe, it, expect, vi } from 'vitest'
import { computeLevel, toStage } from '../repositories/garden.repository'

function makeChain(data: unknown, error: unknown = null) {
  const rpcMock = vi.fn().mockResolvedValue({ data, error })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { rpc: rpcMock } as any, rpcMock }
}

describe('computeLevel', () => {
  it.each([
    [0, 0],   // 0 solved → level 0
    [1, 1],   // 1 solved → level 1
    [2, 1],   // 2 solved → still level 1
    [3, 2],   // 3 solved (threshold) → level 2
    [5, 2],   // 5 solved → still level 2
    [6, 3],   // 6 solved (threshold) → level 3
    [10, 3],  // 10 solved → still level 3
    [11, 4],  // 11 solved (threshold) → level 4
    [15, 4],  // 15 solved → still level 4 (11-15 is the same band)
    [16, 5],  // 16 solved (threshold) → level 5 (11 + 1*5 = 16)
    [50, 11], // 50 solved → level 4 + floor((50-11)/5) = 4 + floor(39/5) = 4 + 7 = 11
  ])('computeLevel(%i) = %i', (count, expected) => {
    expect(computeLevel(count)).toBe(expected)
  })
})

describe('toStage', () => {
  it.each([
    [0, 0],   // 0 solved → stage 0 (seed/empty)
    [1, 1],   // 1 solved → stage 1
    [2, 1],   // 2 solved → still stage 1
    [3, 2],   // 3 solved (threshold) → stage 2
    [5, 2],   // 5 solved → still stage 2
    [6, 3],   // 6 solved (threshold) → stage 3
    [10, 3],  // 10 solved → still stage 3
    [11, 4],  // 11 solved → stage 4 (max)
    [20, 4],  // 20 solved → still stage 4 (max)
    [100, 4], // large value → still stage 4 (max)
  ])('toStage(%i) = %i', (count, expected) => {
    expect(toStage(count)).toBe(expected)
  })
})

describe('getTopicProficiency', () => {
  it('returns topic proficiency array with correct stages', async () => {
    const mockData = [
      { topic: 'array', solved_count: 5, total_received: 8 },
      { topic: 'dynamic-programming', solved_count: 2, total_received: 4 },
    ]
    const { db } = makeChain(mockData)
    const { getTopicProficiency } = await import('../repositories/garden.repository')
    const result = await getTopicProficiency(db, 'user-123')
    expect(result).toHaveLength(2)
    expect(result[0].topic).toBe('array')
    expect(result[0].solvedCount).toBe(5)
    expect(result[0].stage).toBe(2) // 3-5 solved = stage 2
    expect(result[1].stage).toBe(1) // 1-2 solved = stage 1
  })

  it('returns empty array when no history', async () => {
    const { db } = makeChain([])
    const { getTopicProficiency } = await import('../repositories/garden.repository')
    const result = await getTopicProficiency(db, 'user-123')
    expect(result).toHaveLength(0)
  })

  it('throws on supabase error', async () => {
    const { db } = makeChain(null, { message: 'connection failed' })
    const { getTopicProficiency } = await import('../repositories/garden.repository')
    await expect(getTopicProficiency(db, 'user-123')).rejects.toThrow('Failed to fetch topic proficiency')
  })

  it('assigns correct growth stages', async () => {
    const mockData = [
      { topic: 'array', solved_count: 0, total_received: 3 },
      { topic: 'string', solved_count: 1, total_received: 2 },
      { topic: 'binary-search', solved_count: 3, total_received: 5 },
      { topic: 'dynamic-programming', solved_count: 8, total_received: 10 },
      { topic: 'graph', solved_count: 15, total_received: 20 },
    ]
    const { db } = makeChain(mockData)
    const { getTopicProficiency } = await import('../repositories/garden.repository')
    const result = await getTopicProficiency(db, 'user-123')
    expect(result.map(r => r.stage)).toEqual([4, 3, 2, 1, 0])
  })
})

// ---------------------------------------------------------------------------
// getGardenSummary
// ---------------------------------------------------------------------------
describe('getGardenSummary', () => {
  function makeCountMock(receivedCount: number | null, solvedCount: number | null, opts?: {
    receivedError?: unknown
    solvedError?: unknown
  }) {
    let callIndex = 0
    const fromMock = vi.fn().mockImplementation(() => {
      callIndex++
      if (callIndex === 1) {
        // First Promise.all branch: total received
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: receivedCount,
              error: opts?.receivedError ?? null,
            }),
          }),
        }
      }
      // Second: total solved
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({
              count: solvedCount,
              error: opts?.solvedError ?? null,
            }),
          }),
        }),
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { db: { from: fromMock } as any }
  }

  it('returns totalReceived and totalSolved on success', async () => {
    const { db } = makeCountMock(20, 15)
    const { getGardenSummary } = await import('../repositories/garden.repository')
    const result = await getGardenSummary(db, 'user-1')
    expect(result).toEqual({ totalReceived: 20, totalSolved: 15 })
  })

  it('returns 0/0 for a new user with no history', async () => {
    const { db } = makeCountMock(0, 0)
    const { getGardenSummary } = await import('../repositories/garden.repository')
    const result = await getGardenSummary(db, 'user-1')
    expect(result).toEqual({ totalReceived: 0, totalSolved: 0 })
  })

  it('treats null counts as 0', async () => {
    const { db } = makeCountMock(null, null)
    const { getGardenSummary } = await import('../repositories/garden.repository')
    const result = await getGardenSummary(db, 'user-1')
    expect(result).toEqual({ totalReceived: 0, totalSolved: 0 })
  })

  it('throws when received count query errors', async () => {
    const { db } = makeCountMock(0, 0, { receivedError: { message: 'boom' } })
    const { getGardenSummary } = await import('../repositories/garden.repository')
    await expect(getGardenSummary(db, 'user-1')).rejects.toThrow('Failed to fetch garden summary')
  })

  it('throws when solved count query errors', async () => {
    const { db } = makeCountMock(10, 0, { solvedError: { message: 'timeout' } })
    const { getGardenSummary } = await import('../repositories/garden.repository')
    await expect(getGardenSummary(db, 'user-1')).rejects.toThrow('Failed to fetch garden summary')
  })
})

// ---------------------------------------------------------------------------
// getTopicProficiency — alias normalization
// ---------------------------------------------------------------------------
describe('getTopicProficiency — alias normalization', () => {
  it('normalizes bfs alias to breadth-first-search', async () => {
    const mockData = [
      { topic: 'bfs', solved_count: 3, total_received: 5 },
      { topic: 'breadth-first-search', solved_count: 2, total_received: 3 },
    ]
    const rpcMock = vi.fn().mockResolvedValue({ data: mockData, error: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { rpc: rpcMock } as any
    const { getTopicProficiency } = await import('../repositories/garden.repository')
    const result = await getTopicProficiency(db, 'user-1')
    // bfs (3) + breadth-first-search (2) = 5 solved under canonical
    expect(result).toHaveLength(1)
    expect(result[0].topic).toBe('breadth-first-search')
    expect(result[0].solvedCount).toBe(5)
  })

  it('computes correct level from merged counts', async () => {
    const mockData = [
      { topic: 'heap', solved_count: 4, total_received: 6 },     // alias → heap-priority-queue
      { topic: 'heap-priority-queue', solved_count: 7, total_received: 10 },
    ]
    const rpcMock = vi.fn().mockResolvedValue({ data: mockData, error: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { rpc: rpcMock } as any
    const { getTopicProficiency, computeLevel } = await import('../repositories/garden.repository')
    const result = await getTopicProficiency(db, 'user-1')
    expect(result).toHaveLength(1)
    // 4 + 7 = 11 solved → computeLevel(11) = 4
    expect(result[0].level).toBe(computeLevel(11))
  })
})
