import './lib/config.js' // Validate env vars — fail-fast if missing
import * as Sentry from '@sentry/node'
import pLimit from 'p-limit'
import { logger } from './lib/logger.js'
import { supabase } from './lib/supabase.js'
import { channelRegistry } from './channels/registry.js'
import { buildPushJobs } from './workers/push.logic.js'
import { recordPushRun } from './repositories/push.repository.js'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
  })
}

const dispatchLimit = pLimit(5)

async function main() {
  const startMs = Date.now()
  logger.info('Push run started')

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
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err)
      await Sentry.flush(2000)
    }
    process.exit(1)
  })
