import { describe, it, expect } from 'vitest'
import {
  formatTelegramMessage,
  buildFlexBubble,
  formatEmailSubject,
  buildTelegramReplyMarkup,
} from '../utils/notification-formatters.js'
import type { PushMessage } from '../types/push.js'

const msg: PushMessage = {
  title: 'Two Sum',
  difficulty: 'Easy',
  leetcodeId: 1,
  explanation: 'Use a hash map to find complement.',
  url: 'https://caffecode.net/problems/two-sum',
  problemSlug: 'two-sum',
  problemId: 1,
}

// ---------------------------------------------------------------------------
// formatTelegramMessage
// ---------------------------------------------------------------------------
describe('formatTelegramMessage', () => {
  it('contains the problem title', () => {
    expect(formatTelegramMessage(msg)).toContain('Two Sum')
  })

  it('contains the LeetCode number prefixed with #', () => {
    expect(formatTelegramMessage(msg)).toContain('#1')
  })

  it('contains the brand header', () => {
    expect(formatTelegramMessage(msg)).toContain('今日 CaffeCode 題目')
  })

  it('uses green emoji for Easy difficulty', () => {
    expect(formatTelegramMessage(msg)).toContain('🟢')
  })

  it('uses yellow emoji for Medium difficulty', () => {
    const medium = { ...msg, difficulty: 'Medium' }
    expect(formatTelegramMessage(medium)).toContain('🟡')
  })

  it('uses red emoji for Hard difficulty', () => {
    const hard = { ...msg, difficulty: 'Hard' }
    expect(formatTelegramMessage(hard)).toContain('🔴')
  })

  it('falls back to white emoji for unknown difficulty', () => {
    const unknown = { ...msg, difficulty: 'Unknown' }
    expect(formatTelegramMessage(unknown)).toContain('⚪')
  })

  it('wraps the title in <b> tags', () => {
    expect(formatTelegramMessage(msg)).toContain('<b>Two Sum</b>')
  })

  it('does not include the explanation text', () => {
    expect(formatTelegramMessage(msg)).not.toContain('hash map')
  })
})

// ---------------------------------------------------------------------------
// buildFlexBubble
// ---------------------------------------------------------------------------
describe('buildFlexBubble', () => {
  it('returns an object with type "bubble"', () => {
    const bubble = buildFlexBubble(msg) as Record<string, unknown>
    expect(bubble.type).toBe('bubble')
  })

  it('has header, body, and footer properties', () => {
    const bubble = buildFlexBubble(msg) as Record<string, unknown>
    expect(bubble).toHaveProperty('header')
    expect(bubble).toHaveProperty('body')
    expect(bubble).toHaveProperty('footer')
  })

  it('includes the problem title in body contents', () => {
    const bubble = buildFlexBubble(msg) as {
      body: { contents: { text: string }[] }
    }
    const texts = bubble.body.contents.map((c) => c.text)
    expect(texts).toContain('Two Sum')
  })

  it('includes difficulty emoji and LeetCode number in body', () => {
    const bubble = buildFlexBubble(msg) as {
      body: { contents: { text: string }[] }
    }
    const texts = bubble.body.contents.map((c) => c.text)
    expect(texts.some((t) => t.includes('🟢') && t.includes('#1'))).toBe(true)
  })

  it('footer button links to the problem URL', () => {
    const bubble = buildFlexBubble(msg) as {
      footer: { contents: { action: { uri: string } }[] }
    }
    expect(bubble.footer.contents[0].action.uri).toBe(
      'https://caffecode.net/problems/two-sum'
    )
  })

  it('uses yellow emoji for Medium in body text', () => {
    const medium = { ...msg, difficulty: 'Medium' }
    const bubble = buildFlexBubble(medium) as {
      body: { contents: { text: string }[] }
    }
    const texts = bubble.body.contents.map((c) => c.text)
    expect(texts.some((t) => t.includes('🟡'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// formatEmailSubject
// ---------------------------------------------------------------------------
describe('formatEmailSubject', () => {
  it('returns a non-empty string', () => {
    const subject = formatEmailSubject(msg)
    expect(subject.length).toBeGreaterThan(0)
  })

  it('includes the difficulty level', () => {
    expect(formatEmailSubject(msg)).toContain('Easy')
  })

  it('varies by difficulty', () => {
    const hard = { ...msg, difficulty: 'Hard' }
    expect(formatEmailSubject(hard)).toContain('Hard')
    expect(formatEmailSubject(hard)).not.toContain('Easy')
  })
})

// ---------------------------------------------------------------------------
// buildTelegramReplyMarkup
// ---------------------------------------------------------------------------
describe('buildTelegramReplyMarkup', () => {
  it('returns an object with inline_keyboard array', () => {
    const markup = buildTelegramReplyMarkup('https://example.com') as {
      inline_keyboard: unknown[][]
    }
    expect(markup).toHaveProperty('inline_keyboard')
    expect(Array.isArray(markup.inline_keyboard)).toBe(true)
  })

  it('contains a single row with one button only', () => {
    const markup = buildTelegramReplyMarkup('https://example.com') as {
      inline_keyboard: { text: string; url: string }[][]
    }
    expect(markup.inline_keyboard).toHaveLength(1)
    expect(markup.inline_keyboard[0]).toHaveLength(1)
  })

  it('button URL matches the provided URL', () => {
    const url = 'https://caffecode.net/problems/two-sum'
    const markup = buildTelegramReplyMarkup(url) as {
      inline_keyboard: { text: string; url: string }[][]
    }
    expect(markup.inline_keyboard[0][0].url).toBe(url)
  })

  it('button has descriptive text label', () => {
    const markup = buildTelegramReplyMarkup('https://example.com') as {
      inline_keyboard: { text: string; url: string }[][]
    }
    expect(markup.inline_keyboard[0][0].text).toBeTruthy()
  })
})
