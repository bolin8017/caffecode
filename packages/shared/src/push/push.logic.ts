/**
 * Pure push logic — no config singletons imported here.
 * Accepts injected SupabaseClient for testability.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LimitFunction } from 'p-limit'
import pLimit from 'p-limit'
import { selectProblemForUser } from '../services/problem-selector.js'
import type { NotificationChannel } from './channels/interface.js'
import type { ChannelType, Difficulty, PushMessage, SendResult } from '../types/push.js'
import {
  getAllCandidates,
  stampLastPushDate,
  getVerifiedChannelsBulk,
  upsertHistoryBatch,
  advanceListPositions,
  incrementChannelFailures,
  resetChannelFailuresForUsers,
  type PushCandidate,
  type VerifiedChannel,
} from './push.repository.js'
import { logger } from './push.logger.js'

export interface PushJobData {
  userId: string
  channelId: string
  channelType: ChannelType
  channelIdentifier: string
  problemId: number
  title: string
  difficulty: Difficulty
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

/**
 * Concurrency for problem selection per batch. Caps parallel DB reads when
 * picking problems for the current 100-user batch. Overridable via
 * PUSH_SELECT_CONCURRENCY env var (integer 1–50).
 */
function getSelectConcurrency(): number {
  const raw = process.env.PUSH_SELECT_CONCURRENCY
  if (!raw) return 10
  const n = Number.parseInt(raw, 10)
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : 10
}

interface BatchResult {
  jobs: PushJobData[]
  userProblemMap: Map<string, { problemId: number; listId?: number; sequenceNumber?: number }>
}

/** Process a single batch of push candidates into jobs. */
async function processBatch(
  db: SupabaseClient,
  users: PushCandidate[],
): Promise<BatchResult> {
  const limit = pLimit(getSelectConcurrency())
  const settled = await Promise.allSettled(
    users.map(user => limit(async () => {
      const problem = await selectProblemForUser({ ...user, mode: user.active_mode }, db)
      if (!problem) {
        if (user.active_mode === 'list') {
          logger.warn({ userId: user.id, mode: user.active_mode }, 'List completed for user — no more problems in active list')
        } else {
          logger.warn({ userId: user.id, mode: user.active_mode, difficultyMin: user.difficulty_min, difficultyMax: user.difficulty_max }, 'No problem found for candidate')
        }
      }
      return problem ? { user, problem } : null
    }))
  )
  const results = settled.map((r, idx) => {
    if (r.status === 'fulfilled') return r.value
    logger.error({ userId: users[idx].id, error: String(r.reason) }, 'Problem selection failed for candidate')
    return null
  })
  const userProblems = results.filter(
    (r): r is { user: PushCandidate; problem: NonNullable<Awaited<ReturnType<typeof selectProblemForUser>>> } => r !== null
  )

  if (userProblems.length === 0) {
    return { jobs: [], userProblemMap: new Map() }
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
  // Track per-user problem info for post-dispatch stamping
  const userProblemMap = new Map<string, { problemId: number; listId?: number; sequenceNumber?: number }>()

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

    userProblemMap.set(user.id, {
      problemId: problem.problem_id,
      listId: problem.list_id,
      sequenceNumber: problem.sequence_number,
    })
  }

  return { jobs, userProblemMap }
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
  const appUrl = process.env.APP_URL ?? 'https://caffecode.net'
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

    // processBatch: selects problems, collects jobs (no stamping yet)
    const { jobs: batchJobs, userProblemMap } = await processBatch(db, batchUsers)

    if (batchJobs.length === 0) continue

    // Dispatch this batch's jobs immediately (inline), before moving to the next batch.
    // Track channels that hit permanent failure to skip them within the same batch.
    const pausedChannels = new Set<string>()
    const results = await Promise.allSettled(
      batchJobs.map(job => {
        const channel = channelRegistryArg[job.channelType]
        if (!channel) {
          logger.warn({ channelType: job.channelType, userId: job.userId }, 'Unknown channel type — no handler registered')
          return Promise.resolve<SendResult>({ success: false, error: `unknown channel type: ${job.channelType}`, shouldRetry: false })
        }
        return dispatchLimit(async () => {
          // Check inside dispatchLimit so it's evaluated when the job
          // actually executes, not when the map synchronously builds promises.
          if (pausedChannels.has(job.channelId)) {
            return { success: false, error: 'channel paused mid-batch', shouldRetry: false } satisfies SendResult
          }
          const result = await dispatchJob(job, channel, db, appUrl)
          if (!result.success && !result.shouldRetry) {
            pausedChannels.add(job.channelId)
          }
          return result
        })
      })
    )

    succeeded += results.filter(r => r.status === 'fulfilled' && r.value?.success).length
    failed += results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value && !r.value.success)).length

    // Determine which users had at least one successful send
    const successfulUserIds = new Set<string>()
    for (let j = 0; j < batchJobs.length; j++) {
      const r = results[j]
      if (r.status === 'fulfilled' && r.value?.success) {
        successfulUserIds.add(batchJobs[j].userId)
      }
    }

    // Stamp only users with at least one successful delivery
    if (successfulUserIds.size > 0) {
      const deliveredUserIds = [...successfulUserIds]
      const historyEntries = deliveredUserIds
        .map(uid => {
          const info = userProblemMap.get(uid)
          return info ? { userId: uid, problemId: info.problemId } : null
        })
        .filter((e): e is { userId: string; problemId: number } => e !== null)
      const listPositionUpdates = deliveredUserIds
        .map(uid => {
          const info = userProblemMap.get(uid)
          return info?.listId && info?.sequenceNumber
            ? { userId: uid, listId: info.listId, sequenceNumber: info.sequenceNumber }
            : null
        })
        .filter((u): u is { userId: string; listId: number; sequenceNumber: number } => u !== null)

      const writeResults = await Promise.allSettled([
        upsertHistoryBatch(db, historyEntries),
        stampLastPushDate(db, deliveredUserIds),
        advanceListPositions(db, listPositionUpdates),
        resetChannelFailuresForUsers(db, deliveredUserIds),
      ])
      const writeErrors = writeResults
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => String(r.reason))
      if (writeErrors.length > 0) {
        logger.error({ batchNumber: Math.floor(i / BATCH_SIZE) + 1, writeErrors }, 'Post-dispatch writes partially failed')
      }
    }

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
  db: SupabaseClient,
  appUrl = process.env.APP_URL ?? 'https://caffecode.net',
): Promise<SendResult> {
  const msg: PushMessage = {
    title: job.title,
    difficulty: job.difficulty,
    leetcodeId: job.leetcodeId,
    explanation: job.explanation,
    url: `${appUrl}/problems/${job.problemSlug}`,
    problemSlug: job.problemSlug,
    problemId: job.problemId,
  }

  const result = await channel.send(job.channelIdentifier, msg)

  if (!result.success && !result.shouldRetry) {
    await incrementChannelFailures(db, job.channelId)
    logger.warn(
      { channelId: job.channelId, channelType: job.channelType, userId: job.userId },
      'Channel failure counter incremented (permanent failure)',
    )
  }

  return result
}
