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

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  it('total_solves: exact threshold match returns true', () => {
    const ctx: UserBadgeContext = { ...baseCtx, totalSolves: 5 }
    expect(evaluateBadgeCondition({ type: 'total_solves', threshold: 5 }, ctx)).toBe(true)
  })

  it('topic_count: zero topic count does not meet threshold of 1', () => {
    const ctx: UserBadgeContext = { ...baseCtx, topicCount: 0 }
    expect(evaluateBadgeCondition({ type: 'topic_count', threshold: 1 }, ctx)).toBe(false)
  })

  it('topic_level: missing topic in topicLevels returns false', () => {
    const ctx: UserBadgeContext = { ...baseCtx, topicLevels: [] }
    const req: BadgeRequirement = { type: 'topic_level', topic: 'unknown', threshold: 1 }
    expect(evaluateBadgeCondition(req, ctx)).toBe(false)
  })

  it('unknown badge type falls back to false', () => {
    const unknownReq = { type: 'future_badge_type', threshold: 1 } as unknown as BadgeRequirement
    expect(evaluateBadgeCondition(unknownReq, baseCtx)).toBe(false)
  })
})
