import { describe, it, expect, vi } from 'vitest'
import { TelegramChannel } from '../channels/telegram.js'
import type { PushMessage } from '../../types/push.js'

const sendMock = vi.fn()
vi.mock('../../channels/telegram.js', async () => {
  const actual = await vi.importActual<typeof import('../../channels/telegram.js')>('../../channels/telegram.js')
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
    sendMock.mockResolvedValue({ success: true })
    const result = await channel.send('12345', msg)
    expect(sendMock).toHaveBeenCalledWith('fake-token', '12345', msg)
    expect(result.success).toBe(true)
  })
})
