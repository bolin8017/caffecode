import { describe, it, expect } from 'vitest'
import { toUtcHour } from '../timezone'

describe('toUtcHour', () => {
  it('converts Asia/Taipei (UTC+8) hour 9 to UTC hour 1', () => {
    expect(toUtcHour(9, 'Asia/Taipei')).toBe(1)
  })

  it('converts America/New_York (UTC-5 or UTC-4) correctly', () => {
    const result = toUtcHour(9, 'America/New_York')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(23)
    expect([13, 14]).toContain(result)
  })

  it('converts Europe/London UTC+0 (winter) or UTC+1 (summer)', () => {
    const result = toUtcHour(9, 'Europe/London')
    expect([8, 9]).toContain(result)
  })

  it('handles Asia/Kolkata half-hour offset (UTC+5:30) with floor', () => {
    const result = toUtcHour(9, 'Asia/Kolkata')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(23)
    expect([3, 4]).toContain(result)
  })

  it('wraps around midnight: hour 0 in UTC+8 → 16', () => {
    expect(toUtcHour(0, 'Asia/Taipei')).toBe(16)
  })

  it('wraps around for hour 23 in UTC+8 → 15', () => {
    expect(toUtcHour(23, 'Asia/Taipei')).toBe(15)
  })

  it('always returns an integer in range 0–23', () => {
    for (let h = 0; h < 24; h++) {
      const result = toUtcHour(h, 'Asia/Taipei')
      expect(Number.isInteger(result)).toBe(true)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(23)
    }
  })

  it('returns consistent results for same input', () => {
    const a = toUtcHour(12, 'Asia/Tokyo')
    const b = toUtcHour(12, 'Asia/Tokyo')
    expect(a).toBe(b)
  })
})
