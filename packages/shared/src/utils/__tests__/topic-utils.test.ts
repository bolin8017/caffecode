import { describe, it, expect } from 'vitest'
import { topicLabel, topicToVariety, normalizeTopics, TOPIC_ALIASES } from '../topic-utils.js'

// ---------------------------------------------------------------------------
// topicLabel
// ---------------------------------------------------------------------------
describe('topicLabel', () => {
  it('converts kebab-case to Title Case', () => {
    expect(topicLabel('dynamic-programming')).toBe('Dynamic Programming')
  })

  it('handles multi-word topics', () => {
    expect(topicLabel('breadth-first-search')).toBe('Breadth First Search')
  })

  it('handles single word topics', () => {
    expect(topicLabel('array')).toBe('Array')
  })

  it('returns empty string for empty input', () => {
    expect(topicLabel('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// TOPIC_ALIASES consistency
// ---------------------------------------------------------------------------
describe('TOPIC_ALIASES', () => {
  it('all alias values must map to a recognized topic (not Specialty)', () => {
    for (const [alias, canonical] of Object.entries(TOPIC_ALIASES)) {
      expect(topicToVariety(canonical), `alias "${alias}" -> "${canonical}" is not in VARIETY_MAP`).not.toBe('Specialty')
    }
  })
})

// ---------------------------------------------------------------------------
// topicToVariety
// ---------------------------------------------------------------------------
describe('topicToVariety', () => {
  it('returns mapped variety for known topic', () => {
    expect(topicToVariety('dynamic-programming')).toBe('Jamaica Blue Mountain')
    expect(topicToVariety('array')).toBe('Brazil Sundried')
    expect(topicToVariety('graph')).toBe('Geisha')
  })

  it('maps additional canonical topics to their expected variety', () => {
    expect(topicToVariety('hash-table')).toBe('Sumatra')
    expect(topicToVariety('backtracking')).toBe('Costa Rica')
    expect(topicToVariety('trie')).toBe('Vietnam Robusta')
    expect(topicToVariety('sorting')).toBe('Hawaii Kona')
    expect(topicToVariety('matrix')).toBe('Mocha')
  })

  it('returns "Specialty" for unknown topic', () => {
    expect(topicToVariety('quantum-computing')).toBe('Specialty')
  })
})

// ---------------------------------------------------------------------------
// normalizeTopics
// ---------------------------------------------------------------------------
describe('normalizeTopics', () => {
  it('merges alias topics into canonical form', () => {
    const rows = [
      { topic: 'bfs', solved_count: 3, total_received: 5 },
      { topic: 'breadth-first-search', solved_count: 2, total_received: 4 },
    ]
    const result = normalizeTopics(rows)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      topic: 'breadth-first-search',
      solved_count: 5,
      total_received: 9,
    })
  })

  it('returns empty array for empty input', () => {
    expect(normalizeTopics([])).toEqual([])
  })

  it('sorts by solved_count descending', () => {
    const rows = [
      { topic: 'string', solved_count: 2, total_received: 5 },
      { topic: 'array', solved_count: 10, total_received: 15 },
      { topic: 'graph', solved_count: 5, total_received: 8 },
    ]
    const result = normalizeTopics(rows)
    expect(result.map(r => r.topic)).toEqual(['array', 'graph', 'string'])
  })

  it('does not modify input array (immutability)', () => {
    const rows = [
      { topic: 'bfs', solved_count: 3, total_received: 5 },
      { topic: 'breadth-first-search', solved_count: 2, total_received: 4 },
    ]
    const original = JSON.parse(JSON.stringify(rows))
    normalizeTopics(rows)
    expect(rows).toEqual(original)
  })

  it('merges duplicate canonical topics', () => {
    const rows = [
      { topic: 'dfs', solved_count: 4, total_received: 6 },
      { topic: 'depth-first-search', solved_count: 3, total_received: 5 },
      { topic: 'heap', solved_count: 2, total_received: 3 },
      { topic: 'heap-priority-queue', solved_count: 1, total_received: 2 },
    ]
    const result = normalizeTopics(rows)
    expect(result).toHaveLength(2)
    const dfs = result.find(r => r.topic === 'depth-first-search')
    expect(dfs).toEqual({ topic: 'depth-first-search', solved_count: 7, total_received: 11 })
    const heap = result.find(r => r.topic === 'heap-priority-queue')
    expect(heap).toEqual({ topic: 'heap-priority-queue', solved_count: 3, total_received: 5 })
  })

  it('breaks ties by total_received descending', () => {
    const rows = [
      { topic: 'string', solved_count: 5, total_received: 10 },
      { topic: 'array', solved_count: 5, total_received: 15 },
    ]
    const result = normalizeTopics(rows)
    expect(result[0].topic).toBe('array')
    expect(result[1].topic).toBe('string')
  })
})
