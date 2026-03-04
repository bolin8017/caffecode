import type { PushMessage } from '../types/push.js'

const DIFF_EMOJI: Record<string, string> = {
  Easy: '🟢',
  Medium: '🟡',
  Hard: '🔴',
}

export function formatTelegramMessage(msg: PushMessage): string {
  const emoji = DIFF_EMOJI[msg.difficulty] ?? '⚪'
  return [
    '☕ <b>今日 CaffeCode 題目</b>',
    '',
    `${emoji} ${msg.difficulty} · #${msg.leetcodeId}`,
    `<b>${msg.title}</b>`,
  ].join('\n')
}

export function buildTelegramReplyMarkup(url: string, problemId?: number): object {
  const row = [{ text: '查看解題 →', url }]
  if (problemId !== undefined) {
    row.push({ text: '✅ 我解出來了', callback_data: `solved:${problemId}` } as any)
  }
  return { inline_keyboard: [row] }
}

export function buildFlexBubble(msg: PushMessage): object {
  const emoji = DIFF_EMOJI[msg.difficulty] ?? '⚪'
  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: '#0f172a',
      contents: [
        {
          type: 'text',
          text: '☕ 今日 CaffeCode 題目',
          color: '#f8fafc',
          size: 'sm',
          weight: 'bold',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: `${emoji} ${msg.difficulty} · #${msg.leetcodeId}`,
          color: '#6b7280',
          size: 'sm',
        },
        {
          type: 'text',
          text: msg.title,
          size: 'xl',
          weight: 'bold',
          color: '#0f172a',
          wrap: true,
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '查看解題 →',
            uri: msg.url,
          },
          style: 'primary',
          color: '#0f172a',
        },
      ],
    },
  }
}

export function formatEmailSubject(msg: PushMessage): string {
  return `今天來一道 ${msg.difficulty} 題 ☕`
}
