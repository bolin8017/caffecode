import { formatTelegramMessage, buildTelegramReplyMarkup } from '../utils/notification-formatters.js'
import type { PushMessage, SendResult } from '../types/push.js'

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  msg: PushMessage
): Promise<SendResult> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: formatTelegramMessage(msg),
          parse_mode: 'HTML',
          reply_markup: buildTelegramReplyMarkup(msg.url),
        }),
        signal: AbortSignal.timeout(15_000),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      // 400/401/403 = permanent failures (bad request, invalid token, bot blocked)
      const shouldRetry = res.status !== 403 && res.status !== 400 && res.status !== 401
      return { success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}`, shouldRetry }
    }

    return { success: true, shouldRetry: false }
  } catch (err) {
    return { success: false, error: String(err), shouldRetry: true }
  }
}
