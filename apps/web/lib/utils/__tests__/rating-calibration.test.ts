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
})
