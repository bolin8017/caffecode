import { config } from '../lib/config.js'
import { TelegramChannel } from './telegram.js'
import { LineChannel } from './line.js'
import { EmailChannel } from './email.js'
import type { NotificationChannel } from './interface.js'

export const channelRegistry: Record<string, NotificationChannel> = {
  telegram: new TelegramChannel(config.TELEGRAM_BOT_TOKEN),
  line: new LineChannel(config.LINE_CHANNEL_ACCESS_TOKEN),
  ...(config.RESEND_API_KEY
    ? { email: new EmailChannel(config.RESEND_API_KEY, config.RESEND_FROM_EMAIL ?? 'CaffeCode <noreply@caffecode.net>') }
    : {}),
}
