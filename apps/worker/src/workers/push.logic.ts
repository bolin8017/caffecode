/**
 * Pure push logic — no Redis or Supabase singletons imported here.
 * Accepts injected SupabaseClient for testability.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { selectProblemForUser } from '@caffecode/shared'
import type { NotificationChannel } from '../channels/interface.js'
import type { PushMessage, SendResult, Difficulty } from '@caffecode/shared'
import {
  getPushCandidatesBatch,
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
  difficulty: Difficulty
  leetcodeId: number
  explanation: string
  problemSlug: string
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

  // Batch-write history, stamp delivery date, and advance list positions in parallel
  if (historyEntries.length > 0) {
    await Promise.all([
      upsertHistoryBatch(db, historyEntries),
      stampLastPushDate(db, deliveredUserIds),
      advanceListPositions(db, listPositionUpdates),
    ])
  }

  return jobs
}

const MAX_BATCHES = 100 // Safety limit: 100 batches × 100 candidates = 10,000 users max

export async function buildPushJobs(db: SupabaseClient): Promise<PushJobData[]> {
  const allJobs: PushJobData[] = []
  let offset = 0
  let totalCandidates = 0
  let batchCount = 0

  while (batchCount < MAX_BATCHES) {
    const batch = await getPushCandidatesBatch(db, offset, BATCH_SIZE)
    if (batch.length === 0 && offset === 0) {
      logger.info('No push candidates found')
      return []
    }
    if (batch.length === 0) break

    batchCount++
    totalCandidates += batch.length
    logger.info(
      { batchSize: batch.length, offset, batchCount },
      'Processing push candidate batch',
    )

    const batchJobs = await processBatch(db, batch)
    allJobs.push(...batchJobs)

    if (batch.length < BATCH_SIZE) break // Last batch
    offset += BATCH_SIZE
  }

  if (batchCount >= MAX_BATCHES) {
    logger.error({ totalCandidates, batchCount }, 'Push job building hit safety limit — possible infinite loop')
  }

  if (allJobs.length === 0 && totalCandidates > 0) {
    logger.warn('All candidates had no problem to send')
  }

  logger.info({ jobCount: allJobs.length, totalCandidates }, 'Push jobs built')
  return allJobs
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
