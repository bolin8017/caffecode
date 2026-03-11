import { describe, it, expect } from 'vitest'
import { evaluateBadgeCondition } from '../badge-checker.js'
import type { BadgeRequirement, UserBadgeContext } from '../badge-checker.js'

const baseCtx: UserBadgeContext = {
  totalSolves: 10,
  currentStreak: 5,
  topicLevels: [
    { topic: 'array', level: 3 },
    { topic: 'dynamic-programming', level: 1 },
  ],
  topicCount: 4,
}

describe('evaluateBadgeCondition', () => {
  // --- total_solves ---
  it('total_solves: returns false when below threshold', () => {
    const req: BadgeRequirement = { type: 'total_solves', threshold: 11 }
    expect(evaluateBadgeCondition(req, baseCtx)).toBe(false)
  })

  it('total_solves: returns true at exact boundary', () => {
    const req: BadgeRequirement = { type: 'total_solves', threshold: 10 }
    expect(evaluateBadgeCondition(req, baseCtx)).toBe(true)
  })

  // --- streak ---
  it('streak: returns true at exact boundary', () => {
    const req: BadgeRequirement = { type: 'streak', threshold: 5 }
    expect(evaluateBadgeCondition(req, baseCtx)).toBe(true)
  })

  // --- topic_level ---
  it('topic_level: returns false when topic level is below threshold', () => {
    const req: BadgeRequirement = { type: 'topic_level', topic: 'dynamic-programming', threshold: 3 }
    expect(evaluateBadgeCondition(req, baseCtx)).toBe(false)
  })

  it('topic_level: returns true when topic level meets threshold', () => {
    const req: BadgeRequirement = { type: 'topic_level', topic: 'array', threshold: 3 }
    expect(evaluateBadgeCondition(req, baseCtx)).toBe(true)
  })

  // --- topic_count ---
  it('topic_count: returns false when below threshold', () => {
    const req: BadgeRequirement = { type: 'topic_count', threshold: 5 }
    expect(evaluateBadgeCondition(req, baseCtx)).toBe(false)
  })

  it('topic_count: returns true when at threshold', () => {
    const req: BadgeRequirement = { type: 'topic_count', threshold: 4 }
    expect(evaluateBadgeCondition(req, baseCtx)).toBe(true)
  })

  // --- unknown type ---
  it('returns false for unknown requirement type', () => {
    const req = { type: 'cosmic_alignment', threshold: 1 } as unknown as BadgeRequirement
    expect(evaluateBadgeCondition(req, baseCtx)).toBe(false)
  })
})
