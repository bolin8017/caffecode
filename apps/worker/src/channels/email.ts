import { render } from '@react-email/render'
import { createElement } from 'react'
import { sendEmailMessage, type PushMessage, type SendResult } from '@caffecode/shared'
import type { NotificationChannel } from './interface.js'
import { DailyProblemEmail } from './email-template.js'

export class EmailChannel implements NotificationChannel {
  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {}

  async send(emailAddress: string, msg: PushMessage): Promise<SendResult> {
    const html = await render(
      createElement(DailyProblemEmail, {
        title: msg.title,
        difficulty: msg.difficulty,
        leetcodeId: msg.leetcodeId,
        problemUrl: msg.url,
      })
    )

    return sendEmailMessage(this.apiKey, this.from, emailAddress, msg, { html })
  }
}
