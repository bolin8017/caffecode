import { describe, it, expect } from 'vitest'
import { nextLevelThreshold, buildSolveResult, EMPTY_SOLVE_RESULT } from '@/lib/utils/solve-result'
import type { TopicProficiency } from '@/lib/repositories/garden.repository'

describe('nextLevelThreshold', () => {
  it.each([
    [0, 1],   // level 0 → need 1 to reach level 1
    [1, 3],   // level 1 → need 3 to reach level 2
    [2, 3],
    [3, 6],   // level 2 → need 6 to reach level 3
    [5, 6],
    [6, 11],  // level 3 → need 11 to reach level 4
    [10, 11],
    [11, 16], // level 4 → need 16 to reach level 5
    [15, 16],
    [16, 21], // level 5 → need 21 to reach level 6
    [20, 21],
    [21, 26], // level 6 → need 26 to reach level 7
  ])('nextLevelThreshold(%i) = %i', (count, expected) => {
    expect(nextLevelThreshold(count)).toBe(expected)
  })
})

describe('EMPTY_SOLVE_RESULT', () => {
  it('has firstSolve: false', () => {
    expect(EMPTY_SOLVE_RESULT.firstSolve).toBe(false)
  })
})

describe('buildSolveResult', () => {
  const makeTopic = (topic: string, solvedCount: number): TopicProficiency => ({
    topic,
    solvedCount,
    totalReceived: solvedCount + 2,
    stage: 0 as TopicProficiency['stage'],
    level: 0,
  })

  it('detects level-up when solve crosses threshold', () => {
    // DP at 2 solves (level 1) → 3 solves (level 2)
    const before = [makeTopic('dynamic-programming', 2)]
    const result = buildSolveResult(before, ['dynamic-programming'], [])

    expect(result.levelUps).toHaveLength(1)
    expect(result.levelUps[0]).toEqual({
      topic: 'dynamic-programming',
      variety: 'Jamaica Blue Mountain',
      oldLevel: 1,
      newLevel: 2,
      newStage: 2,
    })
    expect(result.firstSolve).toBe(false)
  })

  it('returns empty levelUps when no threshold crossed', () => {
    // DP at 1 solve (level 1) → 2 solves (still level 1)
    const before = [makeTopic('dynamic-programming', 1)]
    const result = buildSolveResult(before, ['dynamic-programming'], [])

    expect(result.levelUps).toHaveLength(0)
    expect(result.firstSolve).toBe(false)
  })

  it('handles new topic not in proficiency (count 0 → 1)', () => {
    const result = buildSolveResult([], ['graph'], [])

    expect(result.levelUps).toHaveLength(1)
    expect(result.levelUps[0]).toMatchObject({
      topic: 'graph',
      oldLevel: 0,
      newLevel: 1,
    })
    expect(result.firstSolve).toBe(false)
  })

  it('includes topicProgress for all problem topics', () => {
    const before = [makeTopic('array', 4), makeTopic('two-pointers', 1)]
    const result = buildSolveResult(before, ['array', 'two-pointers'], [])

    expect(result.topicProgress).toHaveLength(2)
    expect(result.topicProgress[0]).toEqual({
      topic: 'array',
      solvedCount: 5,
      nextThreshold: 6,
      level: 2,
    })
    expect(result.topicProgress[1]).toEqual({
      topic: 'two-pointers',
      solvedCount: 2,
      nextThreshold: 3,
      level: 1,
    })
  })

  it('maps newBadges from Badge objects', () => {
    const badges = [
      { id: 1, slug: 'first-brew', name: 'First Brew', icon: '☕', category: 'milestone' },
    ]
    const result = buildSolveResult([], ['array'], badges)

    expect(result.newBadges).toEqual([{ name: 'First Brew', icon: '☕' }])
    expect(result.firstSolve).toBe(false)
  })

  it('handles multiple simultaneous level-ups', () => {
    // Both topics at threshold boundary
    const before = [makeTopic('array', 2), makeTopic('string', 5)]
    const result = buildSolveResult(before, ['array', 'string'], [])

    expect(result.levelUps).toHaveLength(2)
    expect(result.firstSolve).toBe(false)
  })
})
