import pLimit from 'p-limit'
import { logger } from '@/lib/logger'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildPushJobs,
  recordPushRun,
  createChannelRegistry,
} from '@caffecode/shared'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('Authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 10-minute overlap guard (same logic as worker index.ts)
  const { data: recentRun, error: overlapError } = await supabase
    .from('push_runs')
    .select('id, created_at')
    .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (overlapError) {
    logger.error({ err: overlapError }, 'Overlap guard query failed — proceeding with push run')
  }

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
    const channelRegistry = createChannelRegistry({
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
      lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
      resendApiKey: process.env.RESEND_API_KEY,
      resendFromEmail: process.env.RESEND_FROM_EMAIL,
    })

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
