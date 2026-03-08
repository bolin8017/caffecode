import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '../lib/logger.js'

export interface PushCandidate {
  id: string
  timezone: string
  active_mode: 'list' | 'filter'
  difficulty_min: number
  difficulty_max: number
  topic_filter: string[] | null
  line_push_allowed: boolean
}

export interface VerifiedChannel {
  id: string
  user_id: string
  channel_type: string
  channel_identifier: string
}

export async function getPushCandidatesBatch(
  db: SupabaseClient,
  offset: number,
  batchSize: number = 100,
): Promise<PushCandidate[]> {
  const { data, error } = await db
    .rpc('get_push_candidates')
    .range(offset, offset + batchSize - 1)

  if (error) {
    logger.error({ error, offset, batchSize }, 'Failed to get push candidates batch')
    return []
  }

  return (data ?? []) as PushCandidate[]
}

export async function stampLastPushDate(
  db: SupabaseClient,
  userIds: string[]
): Promise<void> {
  const { error } = await db.rpc('stamp_last_push_date', { p_user_ids: userIds })
  if (error) {
    logger.error({ err: error }, 'stampLastPushDate: RPC failed')
  }
}

export async function getVerifiedChannelsBulk(
  db: SupabaseClient,
  userIds: string[]
): Promise<VerifiedChannel[]> {
  const { data, error } = await db
    .from('notification_channels')
    .select('id, user_id, channel_type, channel_identifier')
    .in('user_id', userIds)
    .eq('is_verified', true)
    .lt('consecutive_send_failures', 3)
  if (error) {
    logger.error({ err: error }, 'getVerifiedChannelsBulk: query failed')
    return []
  }
  return (data ?? []) as VerifiedChannel[]
}

export async function upsertHistoryBatch(
  db: SupabaseClient,
  entries: Array<{ userId: string; problemId: number }>
): Promise<void> {
  if (entries.length === 0) return
  const { error } = await db.from('history').upsert(
    entries.map(e => ({ user_id: e.userId, problem_id: e.problemId })),
    { onConflict: 'user_id,problem_id', ignoreDuplicates: true }
  )
  if (error) {
    logger.error({ err: error }, 'upsertHistoryBatch: upsert failed')
  }
}

export async function advanceListPositions(
  db: SupabaseClient,
  updates: Array<{ userId: string; listId: number; sequenceNumber: number }>
): Promise<void> {
  if (updates.length === 0) return
  const { error } = await db.rpc('advance_list_positions', {
    p_updates: updates.map(u => ({
      user_id: u.userId,
      list_id: u.listId,
      sequence_number: u.sequenceNumber,
    })),
  })
  if (error) {
    logger.error({ err: error }, 'advanceListPositions: RPC failed')
  }
}

export async function incrementChannelFailures(
  db: SupabaseClient,
  channelId: string,
): Promise<void> {
  const { error } = await db.rpc('increment_channel_failures', { p_channel_id: channelId })
  if (error) {
    logger.error({ err: error, channelId }, 'incrementChannelFailures: RPC failed')
  }
}

export async function resetChannelFailures(
  db: SupabaseClient,
  channelId: string,
): Promise<void> {
  const { error } = await db
    .from('notification_channels')
    .update({ consecutive_send_failures: 0 })
    .eq('id', channelId)

  if (error) {
    logger.error({ err: error, channelId }, 'resetChannelFailures: update failed')
  }
}

interface PushRunData {
  candidates: number
  succeeded: number
  failed: number
  durationMs: number
  errorMsg?: string
}

export async function recordPushRun(
  db: SupabaseClient,
  data: PushRunData
): Promise<void> {
  const { error } = await db.from('push_runs').insert({
    candidates: data.candidates,
    succeeded: data.succeeded,
    failed: data.failed,
    duration_ms: data.durationMs,
    error_msg: data.errorMsg ?? null,
  })
  if (error) {
    logger.error({ err: error }, 'recordPushRun: failed to write push_runs row')
  }
}
