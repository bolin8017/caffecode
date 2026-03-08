import { z } from 'zod'

export const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().min(1).default('CaffeCode <noreply@caffecode.net>'),
  APP_URL: z.string().url().default('https://caffecode.net'),
  SENTRY_DSN: z.string().url().optional(),
})

export type Config = z.infer<typeof envSchema>
