import { describe, it, expect } from 'vitest'
import { computeTopicLevel } from './level-calculator.js'

describe('computeTopicLevel', () => {
  it('stage 0 at 0 solves', () => {
    const r = computeTopicLevel(0)
    expect(r.stage).toBe(0)
    expect(r.level).toBe(0)
    expect(r.nextMilestone).toBe(1)
  })

  it('stage 1 at 1-2 solves', () => {
    expect(computeTopicLevel(1).stage).toBe(1)
    expect(computeTopicLevel(2).stage).toBe(1)
    expect(computeTopicLevel(2).nextMilestone).toBe(3)
  })

  it('stage 2 at 3-5 solves', () => {
    expect(computeTopicLevel(3).stage).toBe(2)
    expect(computeTopicLevel(5).stage).toBe(2)
  })

  it('stage 3 at 6-10 solves', () => {
    expect(computeTopicLevel(6).stage).toBe(3)
    expect(computeTopicLevel(10).stage).toBe(3)
  })

  it('stage 4 level 1 at 11-15 solves', () => {
    const r = computeTopicLevel(11)
    expect(r.stage).toBe(4)
    expect(r.level).toBe(1)
    expect(r.nextMilestone).toBe(16)
  })

  it('stage 4 level 2 at 16-20 solves', () => {
    const r = computeTopicLevel(16)
    expect(r.stage).toBe(4)
    expect(r.level).toBe(2)
    expect(r.nextMilestone).toBe(21)
  })

  it('uncapped levels at high solve counts', () => {
    const r = computeTopicLevel(51)
    expect(r.stage).toBe(4)
    expect(r.level).toBe(9)
    expect(r.nextMilestone).toBe(56)
  })

  it('progressInStage is 0-1 range', () => {
    expect(computeTopicLevel(0).progressInStage).toBe(0)
    expect(computeTopicLevel(1).progressInStage).toBe(0)
    expect(computeTopicLevel(2).progressInStage).toBeCloseTo(0.5)
    expect(computeTopicLevel(13).progressInStage).toBeCloseTo(0.4)
  })
})
