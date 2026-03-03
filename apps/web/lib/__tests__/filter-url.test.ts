import { describe, it, expect } from 'vitest'
import { buildFilterUrl, PAGE_SIZE } from '../utils/filter-url'

describe('buildFilterUrl', () => {
  it('returns basePath with no params', () => {
    expect(buildFilterUrl('/problems', {}, {})).toBe('/problems')
  })

  it('preserves existing params', () => {
    const url = buildFilterUrl('/problems', { q: 'tree', difficulty: 'Easy' }, {})
    expect(url).toBe('/problems?q=tree&difficulty=Easy')
  })

  it('applies overrides', () => {
    const url = buildFilterUrl('/problems', { q: 'tree' }, { difficulty: 'Hard' })
    expect(url).toBe('/problems?q=tree&difficulty=Hard')
  })

  it('removes params with null override', () => {
    const url = buildFilterUrl('/problems', { q: 'tree', difficulty: 'Easy' }, { difficulty: null })
    expect(url).toBe('/problems?q=tree')
  })

  it('removes params with empty string override', () => {
    const url = buildFilterUrl('/problems', { difficulty: 'Easy' }, { difficulty: '' })
    expect(url).toBe('/problems')
  })

  it('strips undefined current params', () => {
    const url = buildFilterUrl('/problems', { q: undefined, difficulty: 'Easy' }, {})
    expect(url).toBe('/problems?difficulty=Easy')
  })

  it('resets page to 1 when any non-page param changes', () => {
    const url = buildFilterUrl('/problems', { q: 'tree', page: '3' }, { difficulty: 'Hard' })
    expect(url).toBe('/problems?q=tree&difficulty=Hard')
  })

  it('preserves page when only page changes', () => {
    const url = buildFilterUrl('/problems', { q: 'tree' }, { page: '2' })
    expect(url).toBe('/problems?q=tree&page=2')
  })

  it('omits page=1', () => {
    const url = buildFilterUrl('/problems', {}, { page: '1' })
    expect(url).toBe('/problems')
  })

  it('exports PAGE_SIZE as 50', () => {
    expect(PAGE_SIZE).toBe(50)
  })
})
