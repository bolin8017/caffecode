import { sendLineMessage, type PushMessage, type SendResult } from '@caffecode/shared'
import type { NotificationChannel } from './interface.js'

export class LineChannel implements NotificationChannel {
  constructor(private readonly channelAccessToken: string) {}

  formatMessage(msg: PushMessage): string {
    return `「${msg.title} (${msg.difficulty})」今日 CaffeCode 題目`
  }

  async send(lineUserId: string, msg: PushMessage): Promise<SendResult> {
    return sendLineMessage(this.channelAccessToken, lineUserId, msg)
  }
}
