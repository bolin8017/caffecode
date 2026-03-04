import { describe, it, expect } from 'vitest'
import { parseSolvedCallbackData } from '@/lib/utils/telegram-callback'

describe('parseSolvedCallbackData', () => {
  it('parses valid callback_data', () => {
    expect(parseSolvedCallbackData('solved:42')).toEqual({ problemId: 42 })
  })

  it('returns null for invalid format', () => {
    expect(parseSolvedCallbackData('unknown:42')).toBeNull()
    expect(parseSolvedCallbackData('solved:abc')).toBeNull()
    expect(parseSolvedCallbackData('')).toBeNull()
  })
})
