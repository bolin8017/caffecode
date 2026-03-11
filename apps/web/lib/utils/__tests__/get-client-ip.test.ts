import { describe, it, expect } from 'vitest'
import { getClientIp } from '../rate-limiter'

describe('getClientIp', () => {
  it('extracts first IP from comma-separated x-forwarded-for header', () => {
    const headers = { get: (name: string) => name === 'x-forwarded-for' ? '1.2.3.4, 5.6.7.8, 9.10.11.12' : null }
    expect(getClientIp(headers)).toBe('1.2.3.4')
  })

  it('trims whitespace from IP', () => {
    const headers = { get: (name: string) => name === 'x-forwarded-for' ? '  10.0.0.1 , 10.0.0.2' : null }
    expect(getClientIp(headers)).toBe('10.0.0.1')
  })

  it("returns 'unknown' when no x-forwarded-for header", () => {
    const headers = { get: () => null }
    expect(getClientIp(headers)).toBe('unknown')
  })

  it('handles single IP (no comma)', () => {
    const headers = { get: (name: string) => name === 'x-forwarded-for' ? '192.168.1.1' : null }
    expect(getClientIp(headers)).toBe('192.168.1.1')
  })
})
