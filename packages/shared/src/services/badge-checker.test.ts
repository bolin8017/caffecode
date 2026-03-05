import { describe, it, expect } from 'vitest'
import { evaluateBadgeCondition } from './badge-checker.js'
import type { BadgeRequirement, UserBadgeContext } from './badge-checker.js'

describe('evaluateBadgeCondition', () => {
  const baseCtx: UserBadgeContext = {
    totalSolves: 5,
    currentStreak: 3,
    topicLevels: [
      { topic: 'dynamic-programming', level: 2 },
      { topic: 'array', level: 4 },
      { topic: 'graph', level: 0 },
    ],
    topicCount: 3,
  }

  it('total_solves: met', () => {
    expect(evaluateBadgeCondition({ type: 'total_solves', threshold: 5 }, baseCtx)).toBe(true)
  })

  it('total_solves: not met', () => {
    expect(evaluateBadgeCondition({ type: 'total_solves', threshold: 10 }, baseCtx)).toBe(false)
  })

  it('streak: met', () => {
    expect(evaluateBadgeCondition({ type: 'streak', threshold: 3 }, baseCtx)).toBe(true)
  })

  it('topic_level: met', () => {
    expect(evaluateBadgeCondition({ type: 'topic_level', topic: 'array', threshold: 4 }, baseCtx)).toBe(true)
  })

  it('topic_level: not met', () => {
    expect(evaluateBadgeCondition({ type: 'topic_level', topic: 'graph', threshold: 3 }, baseCtx)).toBe(false)
  })

  it('topic_count: met', () => {
    expect(evaluateBadgeCondition({ type: 'topic_count', threshold: 3 }, baseCtx)).toBe(true)
  })
})
