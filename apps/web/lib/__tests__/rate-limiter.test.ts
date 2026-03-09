import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '../utils/rate-limiter.js'

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const ip = `rate-test-allow-${Date.now()}`
    expect(checkRateLimit(ip)).toBe(true)
  })

  it('blocks requests at the limit', () => {
    const ip = `rate-test-block-${Date.now()}`
    const MAX = 120
    for (let i = 0; i < MAX; i++) checkRateLimit(ip)
    expect(checkRateLimit(ip)).toBe(false)
  })

  it('isolates different IPs independently', () => {
    const ip1 = `rate-test-iso1-${Date.now()}`
    const ip2 = `rate-test-iso2-${Date.now()}`
    const MAX = 120
    for (let i = 0; i < MAX; i++) checkRateLimit(ip1)
    expect(checkRateLimit(ip1)).toBe(false)
    expect(checkRateLimit(ip2)).toBe(true)
  })

  it('allows the first request for a new IP', () => {
    const ip = `rate-test-new-${Date.now()}`
    expect(checkRateLimit(ip)).toBe(true)
  })

  it('respects a custom limit', () => {
    const ip = `rate-test-custom-${Date.now()}`
    for (let i = 0; i < 5; i++) checkRateLimit(ip, 5)
    expect(checkRateLimit(ip, 5)).toBe(false)
  })
})
