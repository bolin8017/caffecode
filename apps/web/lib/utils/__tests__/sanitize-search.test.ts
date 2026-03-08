import { describe, it, expect } from 'vitest'
import { sanitizeSearch } from '../sanitize-search'

describe('sanitizeSearch', () => {
  it('strips PostgREST filter syntax', () => {
    expect(sanitizeSearch('foo,bar')).toBe('foobar')
    expect(sanitizeSearch('a.b(c)"d\'e\\f')).toBe('abcdef')
  })

  it('strips SQL LIKE wildcards', () => {
    expect(sanitizeSearch('%')).toBe('')
    expect(sanitizeSearch('_')).toBe('')
    expect(sanitizeSearch('foo%bar_baz')).toBe('foobarbaz')
  })

  it('passes through safe strings', () => {
    expect(sanitizeSearch('binary search')).toBe('binary search')
    expect(sanitizeSearch('two-sum')).toBe('two-sum')
    expect(sanitizeSearch('123')).toBe('123')
  })

  it('handles empty input', () => {
    expect(sanitizeSearch('')).toBe('')
  })
})
