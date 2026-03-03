import { describe, it, expect } from 'vitest'
import { TelegramChannel } from '../channels/telegram.js'
import type { PushMessage } from '@caffecode/shared'

const msg: PushMessage = {
  title: 'Two Sum',
  difficulty: 'Easy',
  leetcodeId: 1,
  explanation: '使用 **Hash Table** 可以在 O(n) 解決',
  url: 'https://example.com/problems/two-sum',
  problemSlug: 'two-sum',
  problemId: 1,
}

describe('TelegramChannel.formatMessage', () => {
  const channel = new TelegramChannel('fake-token')

  it('shows brand header', () => {
    const formatted = channel.formatMessage(msg)
    expect(formatted).toContain('☕')
    expect(formatted).toContain('今日 CaffeCode 題目')
  })

  it('shows difficulty emoji and LeetCode number', () => {
    const formatted = channel.formatMessage(msg)
    expect(formatted).toContain('🟢')
    expect(formatted).toContain('#1')
  })

  it('shows problem title in bold', () => {
    const formatted = channel.formatMessage(msg)
    expect(formatted).toContain('<b>Two Sum</b>')
  })

  it('does NOT include explanation text', () => {
    const formatted = channel.formatMessage(msg)
    expect(formatted).not.toContain('Hash Table')
  })

  it('uses 🟡 for Medium', () => {
    const medium = { ...msg, difficulty: 'Medium' }
    expect(channel.formatMessage(medium)).toContain('🟡')
  })

  it('uses 🔴 for Hard', () => {
    const hard = { ...msg, difficulty: 'Hard' }
    expect(channel.formatMessage(hard)).toContain('🔴')
  })
})
