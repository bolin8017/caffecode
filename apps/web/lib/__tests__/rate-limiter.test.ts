import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '../utils/rate-limiter.js'

// These tests exercise the in-memory fallback path. UPSTASH_REDIS_REST_URL is
// unset in the test env, so `checkRateLimit` falls through to the Map-based
// implementation and behaves identically to the pre-Upstash version.

describe('checkRateLimit (in-memory fallback)', () => {
  it('allows requests under the limit', async () => {
    const ip = `rate-test-allow-${Date.now()}`
    expect(await checkRateLimit(ip)).toBe(true)
  })

  it('blocks requests at the limit', async () => {
    const ip = `rate-test-block-${Date.now()}`
    const MAX = 120
    for (let i = 0; i < MAX; i++) await checkRateLimit(ip)
    expect(await checkRateLimit(ip)).toBe(false)
  })

  it('isolates different IPs independently', async () => {
    const ip1 = `rate-test-iso1-${Date.now()}`
    const ip2 = `rate-test-iso2-${Date.now()}`
    const MAX = 120
    for (let i = 0; i < MAX; i++) await checkRateLimit(ip1)
    expect(await checkRateLimit(ip1)).toBe(false)
    expect(await checkRateLimit(ip2)).toBe(true)
  })

  it('allows the first request for a new IP', async () => {
    const ip = `rate-test-new-${Date.now()}`
    expect(await checkRateLimit(ip)).toBe(true)
  })

  it('respects a custom limit', async () => {
    const ip = `rate-test-custom-${Date.now()}`
    for (let i = 0; i < 5; i++) await checkRateLimit(ip, 5)
    expect(await checkRateLimit(ip, 5)).toBe(false)
  })
})
