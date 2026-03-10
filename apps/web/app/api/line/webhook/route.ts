import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyChannelByToken } from '@/lib/repositories/channel.repository'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp } from '@/lib/utils/rate-limiter'

function getEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`${name} is not set`)
  return val.trim()
}

function verifyLineSignature(body: string, signature: string): boolean {
  const expected = createHmac('sha256', getEnv('LINE_CHANNEL_SECRET'))
    .update(body)
    .digest('base64')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

async function replyMessage(replyToken: string, text: string) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getEnv('LINE_CHANNEL_ACCESS_TOKEN')}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }],
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      logger.warn({ status: res.status }, 'LINE webhook reply failed')
    }
  } catch (err) {
    logger.error({ error: String(err) }, 'LINE webhook reply error')
  }
}

interface LineTextMessage {
  type: 'text'
  text: string
}

interface LineFollowEvent {
  type: 'follow'
  replyToken: string
  source: { userId: string }
}

interface LineMessageEvent {
  type: 'message'
  replyToken: string
  source: { userId: string }
  message: LineTextMessage
}

type LineEvent = LineFollowEvent | LineMessageEvent | { type: string }

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  if (!checkRateLimit(ip)) {
    logger.warn({ ip }, 'LINE webhook: rate limit exceeded')
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!verifyLineSignature(rawBody, signature)) {
    logger.warn('LINE webhook: invalid signature')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { events: LineEvent[] }
  try {
    body = JSON.parse(rawBody)
  } catch {
    logger.warn('LINE webhook: invalid JSON payload')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body.events)) {
    logger.warn('LINE webhook: missing or invalid events array')
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createServiceClient()

  for (const event of body.events) {
    try {
      if (event.type === 'message') {
        const e = event as LineMessageEvent
        const text = e.message.text?.trim() ?? ''
        const userId = e.source.userId

        // Strict UUID format validation (matching Telegram's pattern)
        const tokenMatch = text.match(/^link_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
        if (tokenMatch) {
          const linkToken = tokenMatch[1]
          if (!linkToken) continue

          const result = await verifyChannelByToken(supabase, linkToken, userId, 'line')

          if (!result) {
            await replyMessage(e.replyToken, '連結失敗：連結已過期或不存在。請返回設定頁重新操作。')
          } else {
            logger.info({ lineUserId: userId, userId: result.user_id }, 'LINE channel linked')
            await replyMessage(e.replyToken, '✅ 連結成功！你將從明天起開始收到每日演算法題目通知。')
          }
        } else if (text.startsWith('link_')) {
          await replyMessage(e.replyToken, '連結失敗：無效的連結格式。請返回設定頁重新取得連結。')
        } else {
          await replyMessage(e.replyToken, '請前往 CaffeCode 設定頁連結你的帳號：\nhttps://caffecode.net/settings')
        }
      }

      if (event.type === 'follow') {
        const e = event as LineFollowEvent
        await replyMessage(
          e.replyToken,
          '歡迎加入 CaffeCode！\n\n請前往設定頁連結你的帳號，開始接收每日演算法題目通知：\nhttps://caffecode.net/settings'
        )
      }
    } catch (err) {
      logger.error({ eventType: event.type, error: String(err) }, 'LINE webhook event processing failed')
    }
  }

  return NextResponse.json({ ok: true })
}
