import { TelegramChannel } from './telegram.js'
import { LineChannel } from './line.js'
import { EmailChannel } from './email.js'
import type { NotificationChannel } from './interface.js'

export interface ChannelRegistryConfig {
  telegramBotToken: string
  lineChannelAccessToken: string
  resendApiKey?: string
  resendFromEmail?: string
}

export function createChannelRegistry(config: ChannelRegistryConfig): Record<string, NotificationChannel> {
  return {
    telegram: new TelegramChannel(config.telegramBotToken),
    line: new LineChannel(config.lineChannelAccessToken),
    ...(config.resendApiKey
      ? { email: new EmailChannel(config.resendApiKey, config.resendFromEmail ?? 'CaffeCode <noreply@caffecode.net>') }
      : {}),
  }
}
