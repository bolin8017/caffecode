import { describe, it, expect } from 'vitest'
import { TelegramHtmlRenderer } from '../renderers/telegram-renderer.js'
import { PlainTextRenderer } from '../renderers/plaintext-renderer.js'

const tg = new TelegramHtmlRenderer()
const pt = new PlainTextRenderer()

// ---------------------------------------------------------------------------
// TelegramHtmlRenderer
// ---------------------------------------------------------------------------
describe('TelegramHtmlRenderer', () => {
  it('renders bold as <b> tags', () => {
    expect(tg.renderMarkdown('**hello**')).toBe('<b>hello</b>')
  })

  it('renders italic as <i> tags', () => {
    expect(tg.renderMarkdown('*hello*')).toBe('<i>hello</i>')
  })

  it('renders inline code as <code> tags', () => {
    expect(tg.renderMarkdown('`foo`')).toBe('<code>foo</code>')
  })

  it('renders code blocks as <pre><code> tags', () => {
    const result = tg.renderMarkdown('```\nconst x = 1\n```')
    expect(result).toContain('<pre><code>')
    expect(result).toContain('const x = 1')
  })

  it('renders links as <a> tags', () => {
    const result = tg.renderMarkdown('[click](https://example.com)')
    expect(result).toBe('<a href="https://example.com">click</a>')
  })

  it('renders headings as bold text', () => {
    expect(tg.renderMarkdown('## Approach')).toBe('<b>Approach</b>')
  })

  it('renders unordered list with bullet prefix', () => {
    const result = tg.renderMarkdown('- item one\n- item two')
    expect(result).toContain('• item one')
    expect(result).toContain('• item two')
  })

  it('renders ordered list with number prefix', () => {
    const result = tg.renderMarkdown('1. first\n2. second')
    expect(result).toContain('1. first')
    expect(result).toContain('2. second')
  })

  it('escapes HTML special characters in text', () => {
    const result = tg.renderMarkdown('a < b & c > d')
    expect(result).toContain('&lt;')
    expect(result).toContain('&amp;')
    expect(result).toContain('&gt;')
  })

  it('wraps pseudocode in <pre> with HTML escaping', () => {
    const result = tg.renderPseudocode('if a < b:\n  return a & b')
    expect(result).toContain('<pre>')
    expect(result).toContain('&lt;')
    expect(result).toContain('&amp;')
  })

  it('returns empty string for empty pseudocode', () => {
    expect(tg.renderPseudocode('')).toBe('')
    expect(tg.renderPseudocode('  ')).toBe('')
  })

  it('returns empty string for empty markdown', () => {
    expect(tg.renderMarkdown('')).toBe('')
    expect(tg.renderMarkdown('  ')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// PlainTextRenderer
// ---------------------------------------------------------------------------
describe('PlainTextRenderer', () => {
  it('strips bold formatting', () => {
    expect(pt.renderMarkdown('**hello**')).toBe('hello')
  })

  it('strips italic formatting', () => {
    expect(pt.renderMarkdown('*hello*')).toBe('hello')
  })

  it('strips inline code backticks', () => {
    const result = pt.renderMarkdown('use `map`')
    expect(result).toContain('map')
    expect(result).not.toContain('`')
  })

  it('extracts link text without URL', () => {
    const result = pt.renderMarkdown('[click](https://example.com)')
    expect(result).toContain('click')
  })

  it('returns pseudocode as-is', () => {
    expect(pt.renderPseudocode('if x > 0: return x')).toBe('if x > 0: return x')
  })

  it('returns empty string for null/undefined pseudocode', () => {
    expect(pt.renderPseudocode(null as unknown as string)).toBe('')
    expect(pt.renderPseudocode(undefined as unknown as string)).toBe('')
  })

  it('returns empty string for empty markdown', () => {
    expect(pt.renderMarkdown('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// BaseRenderer.renderContent (via TelegramHtmlRenderer)
// ---------------------------------------------------------------------------
describe('renderContent', () => {
  it('renders all content fields at once', () => {
    const fields = {
      explanation: '**Bold** explanation',
      complexity_analysis: 'O(n) time',
      pseudocode: 'for i in arr: check',
      alternative_approaches: '- BFS\n- DFS',
      follow_up: '*Think* about edge cases',
    }
    const result = tg.renderContent(fields)
    expect(result.explanation).toContain('<b>Bold</b>')
    expect(result.complexity_analysis).toBe('O(n) time')
    expect(result.pseudocode).toContain('<pre>')
    expect(result.alternative_approaches).toContain('• BFS')
    expect(result.follow_up).toContain('<i>Think</i>')
  })

  it('handles empty fields gracefully', () => {
    const fields = {
      explanation: '',
      complexity_analysis: '',
      pseudocode: '',
      alternative_approaches: '',
      follow_up: '',
    }
    const result = tg.renderContent(fields)
    expect(result.explanation).toBe('')
    expect(result.pseudocode).toBe('')
  })
})
