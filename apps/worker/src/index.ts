import { config } from './lib/config.js'
import pLimit from 'p-limit'
import { logger } from './lib/logger.js'
import { supabase } from './lib/supabase.js'
import { buildPushJobs, recordPushRun, createChannelRegistry } from '@caffecode/shared'

const channelRegistry = createChannelRegistry({
  telegramBotToken: config.TELEGRAM_BOT_TOKEN,
  lineChannelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
  resendApiKey: config.RESEND_API_KEY,
  resendFromEmail: config.RESEND_FROM_EMAIL,
})
const dispatchLimit = pLimit(5)

async function main() {
  const startMs = Date.now()
  logger.info('Push run started')

  // Guard against overlapping Railway cron triggers: skip if a run
  // completed in the last 10 minutes. This is a lightweight check —
  // truly simultaneous starts can still overlap, but stamp_last_push_date
  // + history UNIQUE constraint limit blast radius to duplicate messages.
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
    logger.warn({ recentRunId: recentRun.id, createdAt: recentRun.created_at }, 'Skipping push run — recent run within 10 minutes')
    return
  }

  let succeeded = 0
  let failed = 0
  let totalCandidates = 0
  let errorMsg: string | undefined

  try {
    const stats = await buildPushJobs(supabase, channelRegistry, dispatchLimit)
    succeeded = stats.succeeded
    failed = stats.failed
    totalCandidates = stats.totalCandidates

    if (succeeded === 0 && totalCandidates > 0) {
      errorMsg = `All candidates processed but 0 messages delivered (${totalCandidates} candidates)`
      throw new Error(errorMsg)
    }
  } catch (err) {
    if (!errorMsg) errorMsg = String(err)
    throw err
  } finally {
    await recordPushRun(supabase, {
      candidates: totalCandidates,
      succeeded,
      failed,
      durationMs: Date.now() - startMs,
      errorMsg,
    })
  }
}

main()
  .then(() => {
    logger.info('Push run complete')
    process.exit(0)
  })
  .catch(async (err) => {
    logger.fatal({ err }, 'Push run failed')
    process.exit(1)
  })
