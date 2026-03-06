import { describe, it, expect } from 'vitest'
import { sanitizeRedirect } from '../utils/safe-redirect.js'

describe('sanitizeRedirect', () => {
  it('allows normal paths', () => {
    expect(sanitizeRedirect('/dashboard')).toBe('/dashboard')
    expect(sanitizeRedirect('/settings')).toBe('/settings')
    expect(sanitizeRedirect('/garden')).toBe('/garden')
  })

  it('blocks protocol-relative URLs', () => {
    expect(sanitizeRedirect('//evil.com')).toBe('/dashboard')
    expect(sanitizeRedirect('//evil.com/path')).toBe('/dashboard')
  })

  it('blocks backslash URLs', () => {
    expect(sanitizeRedirect('/\\evil.com')).toBe('/dashboard')
    expect(sanitizeRedirect('\\evil.com')).toBe('/dashboard')
  })

  it('blocks non-path values', () => {
    expect(sanitizeRedirect('https://evil.com')).toBe('/dashboard')
    expect(sanitizeRedirect('javascript:alert(1)')).toBe('/dashboard')
    expect(sanitizeRedirect('')).toBe('/dashboard')
  })

  it('defaults to /dashboard for null/undefined', () => {
    expect(sanitizeRedirect(null)).toBe('/dashboard')
    expect(sanitizeRedirect(undefined)).toBe('/dashboard')
  })
})
