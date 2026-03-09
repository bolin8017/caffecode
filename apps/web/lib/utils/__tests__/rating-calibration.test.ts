import { describe, it, expect } from 'vitest'
import { computeSuggestedRange } from '../rating-calibration'

describe('computeSuggestedRange', () => {
  it('returns null when fewer than 5 feedbacks', () => {
    const feedbacks = [
      { difficulty: 'just_right', rating: 1400 },
      { difficulty: 'just_right', rating: 1500 },
    ]
    expect(computeSuggestedRange(feedbacks)).toBeNull()
  })

  it('uses just_right ratings as primary signal', () => {
    const feedbacks = [
      { difficulty: 'just_right', rating: 1400 },
      { difficulty: 'just_right', rating: 1500 },
      { difficulty: 'just_right', rating: 1600 },
      { difficulty: 'too_easy', rating: 1200 },
      { difficulty: 'too_hard', rating: 1900 },
    ]
    const result = computeSuggestedRange(feedbacks)
    expect(result).not.toBeNull()
    // min = 1400 - 100 = 1300, max = 1600 + 150 = 1750
    expect(result!.min).toBe(1300)
    expect(result!.max).toBe(1750)
  })

  it('falls back to too_easy/too_hard when no just_right', () => {
    const feedbacks = [
      { difficulty: 'too_easy', rating: 1200 },
      { difficulty: 'too_easy', rating: 1300 },
      { difficulty: 'too_hard', rating: 1800 },
      { difficulty: 'too_hard', rating: 1900 },
      { difficulty: 'too_easy', rating: 1100 },
    ]
    const result = computeSuggestedRange(feedbacks)
    expect(result).not.toBeNull()
    // min = max(too_easy=1300) + 50 = 1350, max = min(too_hard=1800) - 50 = 1750
    expect(result!.min).toBe(1350)
    expect(result!.max).toBe(1750)
  })

  it('clamps result to slider bounds 1000–2600', () => {
    const feedbacks = [
      { difficulty: 'just_right', rating: 1050 },
      { difficulty: 'just_right', rating: 1060 },
      { difficulty: 'just_right', rating: 1070 },
      { difficulty: 'too_easy', rating: 800 },
      { difficulty: 'too_hard', rating: 2700 },
    ]
    const result = computeSuggestedRange(feedbacks)
    expect(result).not.toBeNull()
    expect(result!.min).toBeGreaterThanOrEqual(1000)
    expect(result!.max).toBeLessThanOrEqual(2600)
  })

  it('returns null when only one side of signal exists with no just_right', () => {
    const feedbacks = [
      { difficulty: 'too_easy', rating: 1200 },
      { difficulty: 'too_easy', rating: 1300 },
      { difficulty: 'too_easy', rating: 1400 },
      { difficulty: 'too_easy', rating: 1100 },
      { difficulty: 'too_easy', rating: 1000 },
    ]
    expect(computeSuggestedRange(feedbacks)).toBeNull()
  })

  it('all identical just_right ratings produce correct symmetric spread', () => {
    // 5x just_right at 1500 → min = 1500-100 = 1400, max = 1500+150 = 1650
    const feedbacks = Array(5).fill({ difficulty: 'just_right', rating: 1500 })
    const result = computeSuggestedRange(feedbacks)
    expect(result).not.toBeNull()
    expect(result!.min).toBe(1400)
    expect(result!.max).toBe(1650)
  })

  it('clamps min to 1000 when just_right ratings are very low', () => {
    // just_right at [850,860,870,880,890] → min = 850-100 = 750, clamped to 1000
    // max = 890+150 = 1040
    const feedbacks = [850, 860, 870, 880, 890].map(r => ({ difficulty: 'just_right', rating: r }))
    const result = computeSuggestedRange(feedbacks)
    expect(result).not.toBeNull()
    expect(result!.min).toBe(1000)
    expect(result!.max).toBe(1040)
  })

  it('clamps max to 2600 when just_right ratings are very high', () => {
    // just_right at [2500,2510,2520,2530,2540] → max = 2540+150 = 2690, clamped to 2600
    // min = 2500-100 = 2400
    const feedbacks = [2500, 2510, 2520, 2530, 2540].map(r => ({ difficulty: 'just_right', rating: r }))
    const result = computeSuggestedRange(feedbacks)
    expect(result).not.toBeNull()
    expect(result!.min).toBe(2400)
    expect(result!.max).toBe(2600)
  })

  it('returns null when computed min >= max (contradictory feedback)', () => {
    // too_easy at [2000] → min = 2000+50 = 2050; too_hard at [1000] → max = 1000-50 = 950
    // After clamp: min = max(1000, 2050) = 2050, max = min(2600, 950) = 950
    // 2050 >= 950 → null
    const feedbacks = [
      { difficulty: 'too_easy', rating: 2000 },
      { difficulty: 'too_hard', rating: 1000 },
      { difficulty: 'too_easy', rating: 1900 },
      { difficulty: 'too_hard', rating: 1100 },
      { difficulty: 'too_easy', rating: 1800 },
    ]
    expect(computeSuggestedRange(feedbacks)).toBeNull()
  })
})
