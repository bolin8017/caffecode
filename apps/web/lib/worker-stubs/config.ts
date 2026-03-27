/**
 * Stub for apps/worker/src/lib/config.ts used during Next.js web build.
 * The worker's config eagerly parses env via Zod at module load time, which
 * fails at build time when env vars are absent. This stub reads process.env
 * directly (no Zod parse) so the module loads safely during build.
 * At runtime the real env vars are present, so this is safe.
 */
export const config = {
  get SUPABASE_URL() { return process.env.NEXT_PUBLIC_SUPABASE_URL ?? '' },
  get SUPABASE_SERVICE_ROLE_KEY() { return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '' },
  get TELEGRAM_BOT_TOKEN() { return process.env.TELEGRAM_BOT_TOKEN ?? '' },
  get LINE_CHANNEL_ACCESS_TOKEN() { return process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '' },
  get RESEND_API_KEY() { return process.env.RESEND_API_KEY },
  get RESEND_FROM_EMAIL() { return process.env.RESEND_FROM_EMAIL ?? 'CaffeCode <noreply@caffecode.net>' },
  get APP_URL() { return process.env.APP_URL ?? 'https://caffecode.net' },
}
