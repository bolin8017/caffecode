import type { PushMessage, SendResult } from '@caffecode/shared'

export interface NotificationChannel {
  /** Send message to a specific recipient */
  send(channelIdentifier: string, msg: PushMessage): Promise<SendResult>
}
