import { describe, it, expect } from 'vitest'
import { buildFlexBubble } from '../../utils/notification-formatters.js'
import type { PushMessage } from '../../types/push.js'

type FlexBubble = {
  type: string
  header: { type: string; layout: string; paddingAll: string; backgroundColor: string; contents: { type: string; text: string; color: string; size: string; weight: string }[] }
  body: { type: string; layout: string; paddingAll: string; spacing: string; contents: { type: string; text: string; color?: string; size?: string; weight?: string; wrap?: boolean }[] }
  footer: { type: string; layout: string; paddingAll: string; contents: { type: string; action: { type: string; label: string; uri: string }; style: string; color: string }[] }
}

const msg: PushMessage = {
  title: 'Two Sum',
  difficulty: 'Easy',
  leetcodeId: 1,
  explanation: '...',
  url: 'https://example.com/problems/two-sum',
  problemSlug: 'two-sum',
  problemId: 1,
}

describe('buildFlexBubble', () => {
  it('produces a flex bubble object', () => {
    const bubble = buildFlexBubble(msg) as FlexBubble
    expect(bubble.type).toBe('bubble')
  })

  it('includes problem title in body', () => {
    const bubble = buildFlexBubble(msg) as FlexBubble
    const bodyTexts = bubble.body.contents.map((c: { text: string }) => c.text)
    expect(bodyTexts.some((t: string) => t.includes('Two Sum'))).toBe(true)
  })

  it('includes difficulty emoji and LeetCode number', () => {
    const bubble = buildFlexBubble(msg) as FlexBubble
    const bodyTexts = bubble.body.contents.map((c: { text: string }) => c.text)
    expect(bodyTexts.some((t: string) => t.includes('\u{1F7E2}') && t.includes('#1'))).toBe(true)
  })

  it('footer button links to problem URL', () => {
    const bubble = buildFlexBubble(msg) as FlexBubble
    const button = bubble.footer.contents[0]
    expect(button.action.uri).toBe('https://example.com/problems/two-sum')
  })
})
