import { describe, it, expect } from 'vitest'
import { calculateStreak } from '../lib/services/streak.service'

function entry(dateStr: string) {
  // dateStr like '2026-02-28'; use noon UTC to avoid timezone edge cases
  return { solved_at: `${dateStr}T04:00:00Z` }
}

describe('calculateStreak', () => {
  it('returns 0 for empty history', () => {
    expect(calculateStreak([])).toBe(0)
  })

  it('returns 1 when only today has an entry', () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    expect(calculateStreak([entry(today)])).toBe(1)
  })

  it('returns 0 when the last entry is not today', () => {
    // A date far in the past will never match today
    expect(calculateStreak([entry('2020-01-01')])).toBe(0)
  })

  it('counts consecutive days including today', () => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(today.getDate() - 2)

    const entries = [
      entry(fmt.format(today)),
      entry(fmt.format(yesterday)),
      entry(fmt.format(twoDaysAgo)),
    ]
    expect(calculateStreak(entries)).toBe(3)
  })

  it('stops counting at a gap in the streak', () => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const today = new Date()
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(today.getDate() - 2) // skips yesterday

    const entries = [entry(fmt.format(today)), entry(fmt.format(twoDaysAgo))]
    expect(calculateStreak(entries)).toBe(1)
  })

  it('counts consecutive days for Pacific/Auckland (UTC+13)', () => {
    const tz = 'Pacific/Auckland'
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    // Use actual Date objects so solved_at timestamps land on correct local dates
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000)
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000)

    const entries = [
      { solved_at: now.toISOString() },
      { solved_at: yesterday.toISOString() },
      { solved_at: twoDaysAgo.toISOString() },
    ]
    expect(calculateStreak(entries, tz)).toBe(3)
  })

  it('counts consecutive days for Pacific/Honolulu (UTC-10)', () => {
    const tz = 'Pacific/Honolulu'
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000)
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000)

    const entries = [
      { solved_at: now.toISOString() },
      { solved_at: yesterday.toISOString() },
      { solved_at: twoDaysAgo.toISOString() },
    ]
    expect(calculateStreak(entries, tz)).toBe(3)
  })

  it('deduplicates multiple entries on the same day', () => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const today = fmt.format(new Date())
    // T04:00Z = 12:00 Taipei, T08:00Z = 16:00 Taipei — both on the same Taipei day
    const entries = [
      { solved_at: `${today}T04:00:00Z` },
      { solved_at: `${today}T08:00:00Z` },
    ]
    expect(calculateStreak(entries, 'Asia/Taipei')).toBe(1)
  })
})
