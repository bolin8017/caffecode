/**
 * Pure push logic — no Redis or Supabase singletons imported here.
 * Accepts injected SupabaseClient for testability.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LimitFunction } from 'p-limit'
import { selectProblemForUser } from '@caffecode/shared'
import type { NotificationChannel } from '../channels/interface.js'
import type { PushMessage, SendResult } from '@caffecode/shared'
import {
  getAllCandidates,
  stampLastPushDate,
  getVerifiedChannelsBulk,
  upsertHistoryBatch,
  advanceListPositions,
  incrementChannelFailures,
  resetChannelFailures,
  type PushCandidate,
  type VerifiedChannel,
} from '../repositories/push.repository.js'
import { config } from '../lib/config.js'
import { logger } from '../lib/logger.js'

export interface PushJobData {
  userId: string
  channelId: string
  channelType: string
  channelIdentifier: string
  problemId: number
  title: string
  difficulty: string
  leetcodeId: number
  explanation: string
  problemSlug: string
}

export interface PushRunStats {
  totalCandidates: number
  succeeded: number
  failed: number
}

const BATCH_SIZE = 100

/** Process a single batch of push candidates into jobs. */
async function processBatch(
  db: SupabaseClient,
  users: PushCandidate[],
): Promise<PushJobData[]> {
  // Problem selection is per-user (different list position / filter criteria)
  // Parallelized with concurrency limit to avoid overwhelming the DB
  const pLimit = (await import('p-limit')).default
  const limit = pLimit(10)
  const results = await Promise.all(
    users.map(user => limit(async () => {
      const problem = await selectProblemForUser({ ...user, mode: user.active_mode }, db)
      if (!problem) {
        logger.warn({ userId: user.id, mode: user.active_mode }, 'No problem found for candidate')
      }
      return problem ? { user, problem } : null
    }))
  )
  const userProblems = results.filter(
    (r): r is { user: PushCandidate; problem: NonNullable<Awaited<ReturnType<typeof selectProblemForUser>>> } => r !== null
  )

  if (userProblems.length === 0) {
    return []
  }

  // Batch-fetch all channels in one query instead of N queries
  const allChannels = await getVerifiedChannelsBulk(db, userProblems.map(up => up.user.id))
  const channelsByUser = new Map<string, VerifiedChannel[]>()
  for (const ch of allChannels) {
    const list = channelsByUser.get(ch.user_id) ?? []
    list.push(ch)
    channelsByUser.set(ch.user_id, list)
  }

  const jobs: PushJobData[] = []
  const historyEntries: Array<{ userId: string; problemId: number }> = []
  const deliveredUserIds: string[] = []
  const listPositionUpdates: Array<{ userId: string; listId: number; sequenceNumber: number }> = []

  for (const { user, problem } of userProblems) {
    // For LINE channels, also require line_push_allowed (quota control)
    const channels = (channelsByUser.get(user.id) ?? []).filter((ch: VerifiedChannel) =>
      ch.channel_type !== 'line' || user.line_push_allowed === true
    )

    if (channels.length === 0) continue

    for (const ch of channels) {
      jobs.push({
        userId: user.id,
        channelId: ch.id,
        channelType: ch.channel_type,
        channelIdentifier: ch.channel_identifier,
        problemId: problem.problem_id,
        title: problem.title,
        difficulty: problem.difficulty,
        leetcodeId: problem.leetcode_id,
        explanation: problem.explanation,
        problemSlug: problem.slug,
      })
    }

    historyEntries.push({ userId: user.id, problemId: problem.problem_id })
    deliveredUserIds.push(user.id)
    if (problem.list_id && problem.sequence_number) {
      listPositionUpdates.push({ userId: user.id, listId: problem.list_id, sequenceNumber: problem.sequence_number })
    }
  }

  // Stamp delivery date and write history/positions before dispatching.
  // Stamping here (not after dispatch) provides at-most-once delivery:
  // a crash mid-dispatch will not re-deliver to already-stamped users.
  // The stamp window is bounded to this single batch (not all batches),
  // so a crash only risks one batch rather than the entire run.
  if (historyEntries.length > 0) {
    await Promise.all([
      upsertHistoryBatch(db, historyEntries),
      stampLastPushDate(db, deliveredUserIds),
      advanceListPositions(db, listPositionUpdates),
    ])
  }

  return jobs
}

/**
 * Fetch all push candidates in a single RPC snapshot, then process and
 * dispatch each batch of BATCH_SIZE inline.
 *
 * Fetching all candidates first (rather than paginating with an offset) avoids
 * the H-2 skipping bug: stampLastPushDate shrinks the eligible set between
 * pages, causing mid-range users to fall out of subsequent offset windows.
 *
 * Dispatching inline per batch (rather than collecting all jobs first) bounds
 * the C-3 stamp window: if the worker crashes, only the in-flight batch may
 * have been stamped without delivery — not the entire run's worth of users.
 */
export async function buildPushJobs(
  db: SupabaseClient,
  channelRegistryArg: Record<string, NotificationChannel>,
  dispatchLimit: LimitFunction,
): Promise<PushRunStats> {
  const allCandidates = await getAllCandidates(db)

  if (allCandidates.length === 0) {
    logger.info('No push candidates found')
    return { totalCandidates: 0, succeeded: 0, failed: 0 }
  }

  logger.info({ totalCandidates: allCandidates.length }, 'Push candidates snapshot fetched')

  let succeeded = 0
  let failed = 0
  const totalCandidates = allCandidates.length

  for (let i = 0; i < allCandidates.length; i += BATCH_SIZE) {
    const batchUsers = allCandidates.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    logger.info(
      { batchSize: batchUsers.length, batchNumber, offset: i },
      'Processing push candidate batch',
    )

    // processBatch: selects problems, collects jobs, stamps this batch, writes history
    const batchJobs = await processBatch(db, batchUsers)

    if (batchJobs.length === 0) continue

    // Dispatch this batch's jobs immediately (inline), before moving to the next batch
    const results = await Promise.allSettled(
      batchJobs.map(job => {
        const channel = channelRegistryArg[job.channelType]
        if (!channel) return Promise.resolve(null)
        return dispatchLimit(() => dispatchJob(job, channel, db))
      })
    )

    succeeded += results.filter(r => r.status === 'fulfilled' && r.value?.success).length
    failed += results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value && !r.value.success)).length

    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => String(r.reason))

    if (errors.length > 0) {
      logger.warn({ batchNumber, errors: errors.slice(0, 5) }, 'Some dispatches rejected in batch')
    }
  }

  if (succeeded === 0 && totalCandidates > 0) {
    logger.warn({ totalCandidates }, 'All candidates had no problem to send or all dispatches failed')
  }

  logger.info({ totalCandidates, succeeded, failed }, 'Push run complete')
  return { totalCandidates, succeeded, failed }
}

export async function dispatchJob(
  job: PushJobData,
  channel: NotificationChannel,
  db: SupabaseClient
): Promise<SendResult> {
  const msg: PushMessage = {
    title: job.title,
    difficulty: job.difficulty,
    leetcodeId: job.leetcodeId,
    explanation: job.explanation,
    url: `${config.APP_URL}/problems/${job.problemSlug}`,
    problemSlug: job.problemSlug,
    problemId: job.problemId,
  }

  const result = await channel.send(job.channelIdentifier, msg)

  if (result.success) {
    await resetChannelFailures(db, job.channelId)
  } else if (!result.shouldRetry) {
    await incrementChannelFailures(db, job.channelId)
    logger.warn({ channelId: job.channelId, channelType: job.channelType }, 'Channel failure counter incremented (permanent failure)')
  }

  return result
}
