import type { PushMessage, SendResult } from '@caffecode/shared'

export interface NotificationChannel {
  /** Format the message into a channel-specific string */
  formatMessage(msg: PushMessage): string
  /** Send formatted message to a specific recipient */
  send(channelIdentifier: string, msg: PushMessage): Promise<SendResult>
}
