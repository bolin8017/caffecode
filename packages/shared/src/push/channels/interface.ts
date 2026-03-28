import type { PushMessage, SendResult } from '../../types/push.js'

export interface NotificationChannel {
  /** Send message to a specific recipient */
  send(channelIdentifier: string, msg: PushMessage): Promise<SendResult>
}
