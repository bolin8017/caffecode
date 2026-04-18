import { timingSafeEqual } from 'crypto'
import pLimit from 'p-limit'
import { logger } from '@/lib/logger'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildPushJobs,
  recordPushRun,
  createChannelRegistry,
} from '@caffecode/shared'

export const maxDuration = 300

function isValidCronSecret(authHeader: string | null, cronSecret: string | undefined): boolean {
  if (!cronSecret || !authHeader) return false
  const expected = `Bearer ${cronSecret}`
  const headerBuf = Buffer.from(authHeader)
  const expectedBuf = Buffer.from(expected)
  if (headerBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(headerBuf, expectedBuf)
}

export async function POST(request: Request) {
  if (!isValidCronSecret(request.headers.get('Authorization'), process.env.CRON_SECRET)) {
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
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
    const lineChannelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!telegramBotToken || !lineChannelAccessToken) {
      throw new Error('Missing required env vars: TELEGRAM_BOT_TOKEN or LINE_CHANNEL_ACCESS_TOKEN')
    }
    const channelRegistry = createChannelRegistry({
      telegramBotToken,
      lineChannelAccessToken,
      resendApiKey: process.env.RESEND_API_KEY,
      resendFromEmail: process.env.RESEND_FROM_EMAIL,
    })

    // PUSH_DISPATCH_CONCURRENCY (int 1-50, default 5) caps parallel
    // outbound notification sends across all channels.
    const rawDispatch = process.env.PUSH_DISPATCH_CONCURRENCY
    const parsedDispatch = rawDispatch ? Number.parseInt(rawDispatch, 10) : NaN
    const dispatchConcurrency =
      Number.isInteger(parsedDispatch) && parsedDispatch >= 1 && parsedDispatch <= 50
        ? parsedDispatch
        : 5
    const dispatchLimit = pLimit(dispatchConcurrency)
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
