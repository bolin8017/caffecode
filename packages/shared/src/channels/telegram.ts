import { formatTelegramMessage, buildTelegramReplyMarkup } from '../utils/notification-formatters.js'
import type { PushMessage, SendResult } from '../types/push.js'

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text: string
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    signal: AbortSignal.timeout(10_000),
  })
}

export async function removeInlineKeyboard(
  token: string,
  chatId: string,
  messageId: number
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }),
    signal: AbortSignal.timeout(10_000),
  })
}

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
          reply_markup: buildTelegramReplyMarkup(msg.url, msg.problemId),
        }),
        signal: AbortSignal.timeout(15_000),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      const shouldRetry = res.status !== 403 && res.status !== 400
      return { success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}`, shouldRetry }
    }

    return { success: true, shouldRetry: false }
  } catch (err) {
    return { success: false, error: String(err), shouldRetry: true }
  }
}
