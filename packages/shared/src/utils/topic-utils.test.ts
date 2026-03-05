import { describe, it, expect } from 'vitest'
import { topicLabel, topicToVariety, TOPIC_ALIASES, normalizeTopics } from './topic-utils.js'

describe('topicLabel', () => {
  it('converts kebab-case to Title Case', () => {
    expect(topicLabel('dynamic-programming')).toBe('Dynamic Programming')
    expect(topicLabel('hash-table')).toBe('Hash Table')
    expect(topicLabel('array')).toBe('Array')
    expect(topicLabel('two-pointers')).toBe('Two Pointers')
  })
})

describe('topicToVariety', () => {
  it('returns mapped variety for known topics', () => {
    expect(topicToVariety('array')).toBe('Brazil Sundried')
    expect(topicToVariety('dynamic-programming')).toBe('Jamaica Blue Mountain')
  })

  it('returns fallback for unknown topics', () => {
    expect(topicToVariety('some-unknown-topic')).toBe('Specialty')
  })
})

describe('normalizeTopics', () => {
  it('merges alias topics into canonical forms', () => {
    const input = [
      { topic: 'bfs', solved_count: 2, total_received: 3 },
      { topic: 'breadth-first-search', solved_count: 5, total_received: 8 },
      { topic: 'array', solved_count: 10, total_received: 15 },
    ]
    const result = normalizeTopics(input)
    expect(result).toHaveLength(2)
    const bfs = result.find(r => r.topic === 'breadth-first-search')
    expect(bfs?.solved_count).toBe(7)
    expect(bfs?.total_received).toBe(11)
  })

  it('passes through topics without aliases', () => {
    const input = [{ topic: 'array', solved_count: 5, total_received: 8 }]
    const result = normalizeTopics(input)
    expect(result).toEqual(input)
  })
})
