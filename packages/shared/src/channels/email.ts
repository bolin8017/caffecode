import { formatEmailSubject } from '../utils/notification-formatters.js'
import type { PushMessage, SendResult } from '../types/push.js'

export async function sendEmailMessage(
  apiKey: string,
  from: string,
  to: string,
  msg: PushMessage,
  opts?: { html?: string }
): Promise<SendResult> {
  const subject = formatEmailSubject(msg)
  const payload: Record<string, string> = { from, to, subject }

  if (opts?.html) {
    payload.html = opts.html
  } else {
    payload.text = `${subject}\n\n${msg.url}`
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const body = await res.text()
      // 422 = invalid email (permanent)
      // 401 = invalid API key (permanent)
      // 403 = domain not verified / forbidden (permanent)
      // 429/5xx = transient (should retry)
      const shouldRetry = res.status !== 422 && res.status !== 401 && res.status !== 403
      return { success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}`, shouldRetry }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err), shouldRetry: true }
  }
}
