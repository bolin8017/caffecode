import { describe, it, expect, vi } from 'vitest'

function makeChain(data: unknown, error: unknown = null) {
  const rpcMock = vi.fn().mockResolvedValue({ data, error })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { rpc: rpcMock } as any, rpcMock }
}

describe('getTopicProficiency', () => {
  it('returns topic proficiency with level data', async () => {
    const mockData = [
      { topic: 'array', solved_count: 5, total_received: 8 },
      { topic: 'dynamic-programming', solved_count: 2, total_received: 4 },
    ]
    const { db } = makeChain(mockData)
    const { getTopicProficiency } = await import('../repositories/garden.repository')
    const result = await getTopicProficiency(db, 'user-123')
    expect(result).toHaveLength(2)
    // Sorted by solvedCount desc
    expect(result[0].topic).toBe('array')
    expect(result[0].solvedCount).toBe(5)
    expect(result[0].stage).toBe(2) // 3-5 solved = stage 2
    expect(result[0].level).toBe(0)
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

  it('assigns correct growth stages and levels', async () => {
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
    // Sorted by solvedCount desc
    const stages = result.map(r => r.stage)
    expect(stages).toEqual([4, 3, 2, 1, 0])
    // graph at 15 solves = stage 4, level 1
    expect(result[0].level).toBe(1)
  })
})
