import { describe, it, expect } from 'vitest'
import { firstParagraph } from './text.js'

describe('firstParagraph', () => {
  it('returns the first paragraph when multiple paragraphs exist', () => {
    const input = 'First paragraph.\n\nSecond paragraph.'
    expect(firstParagraph(input)).toBe('First paragraph.')
  })

  it('returns the full string if there is no blank line', () => {
    const input = 'Single line text with no blank lines.'
    expect(firstParagraph(input)).toBe('Single line text with no blank lines.')
  })

  it('returns empty string for empty input', () => {
    expect(firstParagraph('')).toBe('')
  })

  it('trims leading/trailing whitespace from the paragraph', () => {
    const input = '  Hello world  \n\nSecond.'
    expect(firstParagraph(input)).toBe('Hello world')
  })

  it('truncates at maxLength and appends ellipsis', () => {
    const input = 'ABCDEFGHIJ\n\nSecond paragraph.'
    expect(firstParagraph(input, 5)).toBe('ABCDE…')
  })

  it('does not truncate when text equals maxLength', () => {
    const input = 'ABCDE\n\nSecond.'
    expect(firstParagraph(input, 5)).toBe('ABCDE')
  })

  it('handles multiple consecutive blank lines as a single separator', () => {
    const input = 'First.\n\n\n\nSecond.'
    expect(firstParagraph(input)).toBe('First.')
  })
})
