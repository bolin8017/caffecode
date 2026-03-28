import { sendTelegramMessage } from '../../channels/telegram.js'
import type { PushMessage, SendResult } from '../../types/push.js'
import type { NotificationChannel } from './interface.js'

export class TelegramChannel implements NotificationChannel {
  constructor(private readonly botToken: string) {}

  async send(chatId: string, msg: PushMessage): Promise<SendResult> {
    return sendTelegramMessage(this.botToken, chatId, msg)
  }
}
