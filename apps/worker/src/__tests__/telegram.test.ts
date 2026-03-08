import { describe, it, expect, vi } from 'vitest'
import { TelegramChannel } from '../channels/telegram.js'
import type { PushMessage } from '@caffecode/shared'

const sendMock = vi.fn()
vi.mock('@caffecode/shared', async () => {
  const actual = await vi.importActual<typeof import('@caffecode/shared')>('@caffecode/shared')
  return {
    ...actual,
    sendTelegramMessage: (...args: unknown[]) => sendMock(...args),
  }
})

const msg: PushMessage = {
  title: 'Two Sum',
  difficulty: 'Easy',
  leetcodeId: 1,
  explanation: '使用 **Hash Table** 可以在 O(n) 解決',
  url: 'https://example.com/problems/two-sum',
  problemSlug: 'two-sum',
  problemId: 1,
}

describe('TelegramChannel.send', () => {
  const channel = new TelegramChannel('fake-token')

  it('delegates to sendTelegramMessage', async () => {
    sendMock.mockResolvedValue({ success: true, shouldRetry: false })
    const result = await channel.send('12345', msg)
    expect(sendMock).toHaveBeenCalledWith('fake-token', '12345', msg)
    expect(result.success).toBe(true)
  })
})
