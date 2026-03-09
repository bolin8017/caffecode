import { buildFlexBubble } from '../utils/notification-formatters.js'
import type { PushMessage, SendResult } from '../types/push.js'

export async function sendLineMessage(
  token: string,
  lineUserId: string,
  msg: PushMessage
): Promise<SendResult> {
  const altText = `「${msg.title} (${msg.difficulty})」今日 CaffeCode 題目`

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'flex',
            altText,
            contents: buildFlexBubble(msg),
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text()
      // 400/401/403 = permanent failures (bad request, invalid token, bot blocked)
      const shouldRetry = res.status !== 400 && res.status !== 403 && res.status !== 401
      return { success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}`, shouldRetry }
    }

    return { success: true, shouldRetry: false }
  } catch (err) {
    return { success: false, error: String(err), shouldRetry: true }
  }
}
