import { createClient } from '@supabase/supabase-js'
import pLimit from 'p-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('Authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Dynamic imports — worker modules eagerly parse env vars at load time,
  // which fails during Next.js build when env vars are absent. Importing
  // inside the handler defers evaluation to runtime when vars are present.
  const { buildPushJobs } = await import('@caffecode/worker/workers/push.logic')
  const { recordPushRun } = await import('@caffecode/worker/repositories/push.repository')
  const { TelegramChannel } = await import('@caffecode/worker/channels/telegram')
  const { LineChannel } = await import('@caffecode/worker/channels/line')
  const { EmailChannel } = await import('@caffecode/worker/channels/email')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 10-minute overlap guard (same logic as worker index.ts)
  const { data: recentRun } = await supabase
    .from('push_runs')
    .select('id, created_at')
    .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentRun) {
    logger.warn({ recentRunId: recentRun.id }, 'Skipping push run — recent run within 10 minutes')
    return Response.json({ skipped: true, reason: 'recent_run' })
  }

  const startMs = Date.now()
  let succeeded = 0
  let failed = 0
  let totalCandidates = 0
  let errorMsg: string | undefined

  try {
    const channelRegistry: Record<string, any> = {
      telegram: new TelegramChannel(process.env.TELEGRAM_BOT_TOKEN!),
      line: new LineChannel(process.env.LINE_CHANNEL_ACCESS_TOKEN!),
      ...(process.env.RESEND_API_KEY
        ? {
            email: new EmailChannel(
              process.env.RESEND_API_KEY,
              process.env.RESEND_FROM_EMAIL ?? 'CaffeCode <noreply@caffecode.net>',
            ),
          }
        : {}),
    }

    const dispatchLimit = pLimit(5)
    const stats = await buildPushJobs(supabase, channelRegistry, dispatchLimit)
    succeeded = stats.succeeded
    failed = stats.failed
    totalCandidates = stats.totalCandidates
  } catch (err) {
    errorMsg = String(err)
    logger.error({ err }, 'Push run failed')
  } finally {
    await recordPushRun(supabase, {
      candidates: totalCandidates,
      succeeded,
      failed,
      durationMs: Date.now() - startMs,
      errorMsg,
    })
  }

  return Response.json({
    ok: !errorMsg,
    candidates: totalCandidates,
    succeeded,
    failed,
    durationMs: Date.now() - startMs,
  })
}
