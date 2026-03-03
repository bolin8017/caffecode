import { sendTelegramMessage, formatTelegramMessage, type PushMessage, type SendResult } from '@caffecode/shared'
import type { NotificationChannel } from './interface.js'

export class TelegramChannel implements NotificationChannel {
  constructor(private readonly botToken: string) {}

  formatMessage(msg: PushMessage): string {
    return formatTelegramMessage(msg)
  }

  async send(chatId: string, msg: PushMessage): Promise<SendResult> {
    return sendTelegramMessage(this.botToken, chatId, msg)
  }
}
