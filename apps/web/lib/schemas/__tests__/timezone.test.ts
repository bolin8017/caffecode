import { describe, it, expect } from 'vitest'
import { timezoneSchema } from '../timezone'

describe('timezoneSchema', () => {
  it('accepts valid IANA timezone (Asia/Taipei)', () => {
    expect(timezoneSchema.safeParse('Asia/Taipei').success).toBe(true)
  })

  it('accepts another valid timezone (America/New_York)', () => {
    expect(timezoneSchema.safeParse('America/New_York').success).toBe(true)
  })

  it("rejects invalid timezone string ('Invalid/Zone')", () => {
    const result = timezoneSchema.safeParse('Invalid/Zone')
    expect(result.success).toBe(false)
  })

  it('rejects empty string', () => {
    const result = timezoneSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  it('rejects non-string input', () => {
    const result = timezoneSchema.safeParse(123)
    expect(result.success).toBe(false)
  })
})
