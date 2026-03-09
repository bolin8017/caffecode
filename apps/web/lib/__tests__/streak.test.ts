import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { calculateStreak } from '../services/streak.service'

describe('calculateStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 for no solved rows', () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
    expect(calculateStreak([], 'Asia/Taipei')).toBe(0)
  })

  it('returns 1 for a single solve on today', () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
    const rows = [{ solved_at: '2026-01-01T10:00:00Z' }]
    expect(calculateStreak(rows, 'Asia/Taipei')).toBe(1)
  })

  describe('year boundary', () => {
    it('counts streak of 2 across Dec 31 → Jan 1 year boundary', () => {
      // Today is Jan 1 2026 in Asia/Taipei (UTC+8). Set system time to Jan 1 10:00 UTC+8 = Jan 1 02:00 UTC
      vi.setSystemTime(new Date('2026-01-01T02:00:00Z'))
      const rows = [
        { solved_at: '2026-01-01T02:00:00Z' }, // Jan 1 in Asia/Taipei
        { solved_at: '2025-12-31T02:00:00Z' }, // Dec 31 in Asia/Taipei
      ]
      expect(calculateStreak(rows, 'Asia/Taipei')).toBe(2)
    })

    it('returns streak of 1 when last solve was Dec 30 (gap across year boundary)', () => {
      // Today is Jan 1 2026, streak should break because Dec 30 is 2 days ago
      vi.setSystemTime(new Date('2026-01-01T02:00:00Z'))
      const rows = [
        { solved_at: '2026-01-01T02:00:00Z' }, // Jan 1 in Asia/Taipei
        { solved_at: '2025-12-30T02:00:00Z' }, // Dec 30 in Asia/Taipei (gap!)
      ]
      expect(calculateStreak(rows, 'Asia/Taipei')).toBe(1)
    })
  })

  describe('month boundary', () => {
    it('counts streak of 2 across Feb 28 → Mar 1 in a non-leap year (2025)', () => {
      // Today is Mar 1 2025 in Asia/Taipei. Feb 2025 has 28 days.
      vi.setSystemTime(new Date('2025-03-01T02:00:00Z'))
      const rows = [
        { solved_at: '2025-03-01T02:00:00Z' }, // Mar 1 in Asia/Taipei
        { solved_at: '2025-02-28T02:00:00Z' }, // Feb 28 in Asia/Taipei
      ]
      expect(calculateStreak(rows, 'Asia/Taipei')).toBe(2)
    })

    it('counts streak of 2 across Feb 29 → Mar 1 in a leap year (2028)', () => {
      // 2028 is a leap year; Feb 29 exists
      vi.setSystemTime(new Date('2028-03-01T02:00:00Z'))
      const rows = [
        { solved_at: '2028-03-01T02:00:00Z' }, // Mar 1 in Asia/Taipei
        { solved_at: '2028-02-29T02:00:00Z' }, // Feb 29 in Asia/Taipei (leap day)
      ]
      expect(calculateStreak(rows, 'Asia/Taipei')).toBe(2)
    })

    it('counts streak of 3 across month boundary (Jan 31 → Feb 1 → Feb 2)', () => {
      vi.setSystemTime(new Date('2026-02-02T02:00:00Z'))
      const rows = [
        { solved_at: '2026-02-02T02:00:00Z' }, // Feb 2
        { solved_at: '2026-02-01T02:00:00Z' }, // Feb 1
        { solved_at: '2026-01-31T02:00:00Z' }, // Jan 31
      ]
      expect(calculateStreak(rows, 'Asia/Taipei')).toBe(3)
    })
  })
})
