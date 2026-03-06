import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyChannelByToken } from '@/lib/repositories/channel.repository'
import { logger } from '@/lib/logger'

function getEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`${name} is not set`)
  return val.trim()
}

interface TelegramMessage {
  message_id: number
  chat: { id: number }
  text?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

async function sendTelegramMessage(chatId: number, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${getEnv('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      logger.warn({ chatId, status: res.status }, 'Telegram webhook reply failed')
    }
  } catch (err) {
    logger.error({ chatId, error: String(err) }, 'Telegram webhook reply error')
  }
}

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
  let secretValid = false
  const webhookSecret = getEnv('TELEGRAM_WEBHOOK_SECRET')
  if (webhookSecret && secretHeader) {
    try {
      secretValid = timingSafeEqual(Buffer.from(secretHeader), Buffer.from(webhookSecret))
    } catch (err) {
      if (!(err instanceof RangeError)) {
        logger.error({ error: String(err) }, 'Unexpected error in Telegram signature verification')
      }
    }
  }
  if (!secretValid) {
    logger.warn('Telegram webhook: invalid secret token')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json()
  } catch {
    logger.warn('Telegram webhook: invalid JSON payload')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = update.message
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId = message.chat.id
  const text = message.text.trim()

  // Handle deep link (/start link_<token>) or manually pasted token (link_<token>)
  const linkTokenMatch = text.match(/^(?:\/start )?link_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
  if (linkTokenMatch) {
    const linkToken = linkTokenMatch[1]

    try {
      const supabase = createServiceClient()
      const result = await verifyChannelByToken(supabase, linkToken, String(chatId))

      if (!result) {
        await sendTelegramMessage(chatId, '連結失敗：連結已過期或不存在。請返回設定頁重新操作。\nhttps://caffecode.net/settings')
        return NextResponse.json({ ok: true })
      }

      logger.info({ chatId, userId: result.user_id }, 'Telegram channel linked')
      await sendTelegramMessage(
        chatId,
        '✅ 連結成功！你將從明天起開始收到每日演算法題目通知。'
      )
    } catch (err) {
      logger.error({ chatId, error: String(err) }, 'Telegram channel verification failed')
      await sendTelegramMessage(chatId, '連結失敗：系統發生錯誤，請稍後重試。')
    }
    return NextResponse.json({ ok: true })
  }

  if (text.startsWith('/start')) {
    await sendTelegramMessage(
      chatId,
      '歡迎使用 CaffeCode！\n\n請前往設定頁連結你的帳號，開始接收每日演算法題目通知：\nhttps://caffecode.net/settings'
    )
    return NextResponse.json({ ok: true })
  }

  await sendTelegramMessage(
    chatId,
    '請前往 CaffeCode 設定頁管理你的通知：\nhttps://caffecode.net/settings'
  )
  return NextResponse.json({ ok: true })
}
