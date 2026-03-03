import 'dotenv/config'
import './lib/config.js' // Validate env vars — fail-fast if missing
import * as Sentry from '@sentry/node'
import pLimit from 'p-limit'
import { logger } from './lib/logger.js'
import { supabase } from './lib/supabase.js'
import { channelRegistry } from './channels/registry.js'
import { buildPushJobs, dispatchJob } from './workers/push.logic.js'
import { recordPushRun } from './repositories/push.repository.js'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
  })
}

const limit = pLimit(5)

async function main() {
  const startMs = Date.now()
  logger.info('Push run started')

  const jobs = await buildPushJobs(supabase)

  if (jobs.length === 0) {
    logger.info('No push jobs to dispatch')
    await recordPushRun(supabase, { candidates: 0, succeeded: 0, failed: 0, durationMs: Date.now() - startMs })
    return
  }

  let succeeded = 0
  let failed = 0
  let errorMsg: string | undefined

  try {
    const results = await Promise.allSettled(
      jobs.map(jobData => {
        const channel = channelRegistry[jobData.channelType]
        if (!channel) return Promise.resolve(null)
        return limit(() => dispatchJob(jobData, channel, supabase))
      })
    )

    succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.success).length
    failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value && !r.value.success)).length
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => String(r.reason))

    logger.info({ total: jobs.length, succeeded, failed, errors: errors.slice(0, 5) }, 'Dispatch complete')

    if (succeeded === 0 && jobs.length > 0) {
      errorMsg = `All ${jobs.length} push jobs failed`
      throw new Error(errorMsg)
    }
  } finally {
    await recordPushRun(supabase, {
      candidates: jobs.length,
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
