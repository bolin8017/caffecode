import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JsonLd } from '@/components/seo/json-ld'
import { createElement } from 'react'

describe('JsonLd', () => {
  it('renders script tag with application/ld+json type', () => {
    const data = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Test' }
    const html = renderToStaticMarkup(createElement(JsonLd, { data }))
    expect(html).toContain('type="application/ld+json"')
    expect(html).toContain('"@type":"Organization"')
    expect(html).toContain('"name":"Test"')
  })
})
