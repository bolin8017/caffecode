import { render } from '@react-email/render'
import { createElement } from 'react'
import { sendTelegramMessage } from '../../channels/telegram.js'
import { sendLineMessage } from '../../channels/line.js'
import { sendEmailMessage } from '../../channels/email.js'
import { DailyProblemEmail } from './email-template.js'
import type { PushMessage, SendResult } from '../../types/push.js'

/** A notification channel is a function that delivers a push message to one recipient. */
export type NotificationChannel = (
  identifier: string,
  msg: PushMessage,
) => Promise<SendResult>

export interface ChannelRegistryConfig {
  telegramBotToken: string
  lineChannelAccessToken: string
  resendApiKey?: string
  resendFromEmail?: string
}

const DEFAULT_EMAIL_FROM = 'CaffeCode <noreply@caffecode.net>'

async function renderDailyProblemEmail(msg: PushMessage): Promise<string> {
  return render(
    createElement(DailyProblemEmail, {
      title: msg.title,
      difficulty: msg.difficulty,
      leetcodeId: msg.leetcodeId,
      problemUrl: msg.url,
    }),
  )
}

export function createChannelRegistry(
  config: ChannelRegistryConfig,
): Record<string, NotificationChannel> {
  const registry: Record<string, NotificationChannel> = {
    telegram: (id, msg) => sendTelegramMessage(config.telegramBotToken, id, msg),
    line: (id, msg) => sendLineMessage(config.lineChannelAccessToken, id, msg),
  }
  if (config.resendApiKey) {
    const apiKey = config.resendApiKey
    const from = config.resendFromEmail ?? DEFAULT_EMAIL_FROM
    registry.email = async (id, msg) => {
      const html = await renderDailyProblemEmail(msg)
      return sendEmailMessage(apiKey, from, id, msg, { html })
    }
  }
  return registry
}
