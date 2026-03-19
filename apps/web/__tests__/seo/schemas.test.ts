import { describe, it, expect } from 'vitest'
import {
  organizationSchema,
  webSiteSchema,
  breadcrumbSchema,
  learningResourceSchema,
  itemListSchema,
} from '@/lib/seo/schemas'

describe('organizationSchema', () => {
  it('returns valid Organization schema', () => {
    const schema = organizationSchema()
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@type']).toBe('Organization')
    expect(schema.name).toBe('CaffeCode')
    expect(schema.url).toBe('https://caffecode.net')
    expect(schema.logo).toBe('https://caffecode.net/logo.png')
    expect(schema.sameAs).toContain('https://github.com/bolin8017/caffecode')
  })
})

describe('webSiteSchema', () => {
  it('returns valid WebSite schema with SearchAction', () => {
    const schema = webSiteSchema()
    expect(schema['@type']).toBe('WebSite')
    expect(schema.potentialAction['@type']).toBe('SearchAction')
    expect(schema.potentialAction.target).toContain('{search_term_string}')
  })
})

describe('breadcrumbSchema', () => {
  it('returns BreadcrumbList with correct positions', () => {
    const schema = breadcrumbSchema([
      { name: 'Home', url: 'https://caffecode.net' },
      { name: 'Problems', url: 'https://caffecode.net/problems' },
      { name: 'Two Sum', url: 'https://caffecode.net/problems/two-sum' },
    ])
    expect(schema['@type']).toBe('BreadcrumbList')
    expect(schema.itemListElement).toHaveLength(3)
    expect(schema.itemListElement[0].position).toBe(1)
    expect(schema.itemListElement[2].position).toBe(3)
    expect(schema.itemListElement[2].name).toBe('Two Sum')
  })
})

describe('learningResourceSchema', () => {
  it('maps Easy to Beginner', () => {
    const schema = learningResourceSchema({
      title: 'Two Sum', slug: 'two-sum',
      difficulty: 'Easy', topics: ['Array', 'Hash Table'],
    })
    expect(schema['@type']).toBe('LearningResource')
    expect(schema.educationalLevel).toBe('Beginner')
    expect(schema.keywords).toBe('Array, Hash Table')
  })

  it('maps Medium to Intermediate', () => {
    const schema = learningResourceSchema({
      title: 'LRU Cache', slug: 'lru-cache',
      difficulty: 'Medium', topics: ['Design'],
    })
    expect(schema.educationalLevel).toBe('Intermediate')
  })

  it('maps Hard to Advanced', () => {
    const schema = learningResourceSchema({
      title: 'Median', slug: 'median',
      difficulty: 'Hard', topics: ['Binary Search'],
    })
    expect(schema.educationalLevel).toBe('Advanced')
  })
})

describe('itemListSchema', () => {
  it('returns ItemList with numbered elements', () => {
    const schema = itemListSchema('Blind 75', [
      { title: 'Two Sum', slug: 'two-sum' },
      { title: 'Valid Parentheses', slug: 'valid-parentheses' },
    ])
    expect(schema['@type']).toBe('ItemList')
    expect(schema.name).toBe('Blind 75')
    expect(schema.numberOfItems).toBe(2)
    expect(schema.itemListElement[0].position).toBe(1)
    expect(schema.itemListElement[1].url).toBe(
      'https://caffecode.net/problems/valid-parentheses'
    )
  })
})
