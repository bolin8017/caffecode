// packages/shared/src/push/__tests__/line-channel.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { PushMessage, SendResult } from '../../types/push.js'

// Mock the shared sendLineMessage
const mockSendLineMessage = vi.fn()
vi.mock('../../channels/line.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../channels/line.js')>()
  return {
    ...actual,
    sendLineMessage: (...args: unknown[]) => mockSendLineMessage(...args),
  }
})

import { LineChannel } from '../channels/line.js'

const sampleMsg: PushMessage = {
  title: 'Two Sum',
  difficulty: 'Easy',
  leetcodeId: 1,
  explanation: 'Use a hash map.',
  url: 'https://caffecode.net/problems/two-sum',
  problemSlug: 'two-sum',
  problemId: 42,
}

describe('LineChannel', () => {
  it('delegates to shared sendLineMessage with correct args', async () => {
    const expectedResult: SendResult = { success: true, shouldRetry: false }
    mockSendLineMessage.mockResolvedValue(expectedResult)

    const channel = new LineChannel('test-line-token')
    const result = await channel.send('line-user-123', sampleMsg)

    expect(mockSendLineMessage).toHaveBeenCalledWith(
      'test-line-token',
      'line-user-123',
      sampleMsg,
    )
    expect(result).toEqual(expectedResult)
  })

  it('propagates failure SendResult from shared sender', async () => {
    const failResult: SendResult = {
      success: false,
      shouldRetry: false,
      error: 'HTTP 403: bot blocked',
    }
    mockSendLineMessage.mockResolvedValue(failResult)

    const channel = new LineChannel('test-line-token')
    const result = await channel.send('line-user-456', sampleMsg)

    expect(result.success).toBe(false)
    expect(result.shouldRetry).toBe(false)
    expect(result.error).toBe('HTTP 403: bot blocked')
  })
})
