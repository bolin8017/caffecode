---
paths:
  - "apps/web/app/api/telegram/**"
  - "apps/web/app/api/line/**"
  - "packages/shared/src/channels/**"
  - "apps/web/lib/actions/telegram.ts"
  - "apps/web/lib/actions/line.ts"
  - "apps/web/lib/actions/email.ts"
---

# Notification Channel Details

## Telegram

- Production: `@CaffeCodeBot` -> webhook `https://caffecode.net/api/telegram/webhook`
- Dev: `@CaffeCodeDevBot` (token in `.env.local`)
- Local testing: cloudflared tunnel -> setWebhook

## LINE

- Official account: `@624yzmrd`
- Webhook: `https://caffecode.net/api/line/webhook`
- Free tier: 200 msg/month -> `line_push_allowed` admin flag gates access (~6 users)
- Env var pitfall: Use `printf` not `echo` when piping to `vercel env add` (trailing newline)

## Email

- Resend domain: `caffecode.net` (Cloudflare DNS, verified SPF/DKIM/DMARC)
- From: `CaffeCode <noreply@caffecode.net>`
- Cron route renders React Email HTML via `packages/shared/src/push/channels/email-template.tsx`; admin sends plain text
