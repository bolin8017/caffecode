'use server'

import { z } from 'zod'
import { logger } from '@/lib/logger'
import {
  sendTelegramMessage,
  sendLineMessage,
  sendEmailMessage,
  selectProblemForUser,
  type PushMessage,
  type SendResult,
  type LearningMode,
} from '@caffecode/shared'
import { requireAdmin, runAdminAction } from './_admin-helpers'

// ── Problems ───────────────────────────────────────────────────

export async function deleteProblem(id: number) {
  z.number().int().positive().parse(id)
  return runAdminAction(
    'deleteProblem',
    async ({ db }) => {
      const { error } = await db.from('problems').delete().eq('id', id)
      if (error) throw error
    },
    { revalidate: '/admin/problems', errorMessage: 'Failed to delete problem', logContext: { problemId: id } },
  )
}

// ── Content ────────────────────────────────────────────────────

export async function flagForRegeneration(problemId: number) {
  z.number().int().positive().parse(problemId)
  return runAdminAction(
    'flagForRegeneration',
    async ({ db }) => {
      const { error } = await db
        .from('problem_content')
        .update({ needs_regeneration: true })
        .eq('problem_id', problemId)
      if (error) throw error
    },
    { revalidate: '/admin/content', errorMessage: 'Failed to flag for regeneration', logContext: { problemId } },
  )
}

export async function unflagRegeneration(problemId: number) {
  z.number().int().positive().parse(problemId)
  return runAdminAction(
    'unflagRegeneration',
    async ({ db }) => {
      const { error } = await db
        .from('problem_content')
        .update({ needs_regeneration: false })
        .eq('problem_id', problemId)
      if (error) throw error
    },
    { revalidate: '/admin/content', errorMessage: 'Failed to unflag regeneration', logContext: { problemId } },
  )
}

export async function setLinePushAllowed(userId: string, allowed: boolean) {
  z.string().uuid().parse(userId)
  z.boolean().parse(allowed)
  return runAdminAction(
    'setLinePushAllowed',
    async ({ db }) => {
      const { error } = await db.from('users').update({ line_push_allowed: allowed }).eq('id', userId)
      if (error) throw error
    },
    { revalidate: '/admin/users', errorMessage: 'Failed to update LINE push allowed', logContext: { userId } },
  )
}

// deleteUser has specific business-rule error messages that should surface to
// the caller (self-delete guard, admin-target guard, target-lookup failure).
// runAdminAction's blanket error masking would obscure those, so we use
// requireAdmin directly and handle errors per branch.
export async function deleteUser(userId: string) {
  z.string().uuid().parse(userId)
  const { userId: adminId, db } = await requireAdmin()

  if (userId === adminId) {
    throw new Error('Cannot delete your own admin account')
  }

  const { data: targetProfile, error: targetError } = await db
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single()
  if (targetError) {
    logger.error({ error: targetError, targetUserId: userId }, 'deleteUser: target lookup failed')
    throw new Error('Failed to verify target user')
  }
  if (targetProfile?.is_admin) {
    throw new Error('Cannot delete another admin account')
  }

  // Delete auth user first — if this fails, DB data is still intact
  const { error: authError } = await db.auth.admin.deleteUser(userId)
  if (authError) {
    logger.error({ userId, error: authError }, 'deleteUser: auth deletion failed')
    throw new Error('Failed to delete user')
  }
  // Then delete DB row (cascades to all dependent records)
  const { error: dbError } = await db.from('users').delete().eq('id', userId)
  if (dbError) {
    logger.error({ userId, error: dbError }, 'deleteUser: DB deletion failed')
    throw new Error('Failed to delete user')
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/users')
}

// ── Force Notify ────────────────────────────────────────────────
// Sends notifications to ALL push-enabled users immediately,
// bypassing push_hour_utc and last_push_date filters.
// Intended for testing with test accounts.

const APP_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://caffecode.net').trim()

async function dispatchToChannel(
  channelType: string,
  channelIdentifier: string,
  msg: PushMessage,
): Promise<SendResult> {
  if (channelType === 'telegram') {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return { success: false, error: 'TELEGRAM_BOT_TOKEN not set', shouldRetry: false }
    return sendTelegramMessage(token, channelIdentifier, msg)
  }
  if (channelType === 'line') {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token) return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not set', shouldRetry: false }
    return sendLineMessage(token, channelIdentifier, msg)
  }
  if (channelType === 'email') {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return { success: false, error: 'RESEND_API_KEY not set', shouldRetry: false }
    const from = process.env.RESEND_FROM_EMAIL ?? 'CaffeCode <noreply@caffecode.net>'
    return sendEmailMessage(apiKey, from, channelIdentifier, msg)
  }
  return { success: false, error: `Unknown channel type: ${channelType}`, shouldRetry: false }
}

// Types for per-user results
interface ChannelResult {
  type: string
  success: boolean
  error?: string
}

interface NotifyUserResult {
  userId: string
  displayName: string
  status: 'success' | 'failed' | 'skipped'
  channels: ChannelResult[]
  problemTitle?: string
}

export interface ForceNotifyResult {
  results: NotifyUserResult[]
  summary: { sent: number; failed: number; skipped: number }
}

export async function forceNotifyAll(): Promise<ForceNotifyResult> {
  const { db } = await requireAdmin()

  const { data: users, error: usersError } = await db
    .from('users')
    .select('id, display_name, email, active_mode, difficulty_min, difficulty_max, topic_filter, line_push_allowed')
    .eq('push_enabled', true)

  if (usersError) {
    logger.error({ error: usersError.message }, 'forceNotifyAll: failed to fetch push-enabled users')
    return { results: [], summary: { sent: 0, failed: 0, skipped: 0 } }
  }
  if (!users?.length) return { results: [], summary: { sent: 0, failed: 0, skipped: 0 } }

  const { data: allChannels, error: channelsError } = await db
    .from('notification_channels')
    .select('id, user_id, channel_type, channel_identifier')
    .in('user_id', users.map(u => u.id))
    .eq('is_verified', true)
    .lt('consecutive_send_failures', 3)

  if (channelsError) {
    logger.error({ error: channelsError.message }, 'forceNotifyAll: failed to fetch notification channels')
    return { results: [], summary: { sent: 0, failed: 0, skipped: 0 } }
  }

  const channelsByUser = new Map<string, Array<{ id: string; channel_type: string; channel_identifier: string }>>()
  for (const ch of allChannels ?? []) {
    const list = channelsByUser.get(ch.user_id) ?? []
    list.push(ch)
    channelsByUser.set(ch.user_id, list)
  }

  const results: NotifyUserResult[] = []
  const historyEntries: Array<{ user_id: string; problem_id: number }> = []
  const deliveredUserIds: string[] = []
  const listPositionUpdates: Array<{ user_id: string; list_id: number; sequence_number: number }> = []

  // First pass: parallel problem selection with p-limit(10)
  const pLimit = (await import('p-limit')).default
  const limit = pLimit(10)

  const settled = await Promise.allSettled(
    users.map(user => limit(async () => {
      const displayName = user.display_name ?? user.email ?? '—'
      const channels = (channelsByUser.get(user.id) ?? []).filter(
        ch => ch.channel_type !== 'line' || user.line_push_allowed,
      )

      if (!channels.length) {
        return { user, displayName, channels, problem: null as Awaited<ReturnType<typeof selectProblemForUser>> }
      }

      const problem = await selectProblemForUser(
        {
          id: user.id,
          mode: user.active_mode as LearningMode,
          difficulty_min: user.difficulty_min,
          difficulty_max: user.difficulty_max,
          topic_filter: user.topic_filter ?? null,
        },
        db,
      )
      return { user, displayName, channels, problem }
    })),
  )
  const userProblems = settled.map((r, idx) => {
    if (r.status === 'fulfilled') return r.value
    logger.error({ userId: users[idx].id, error: String(r.reason) }, 'forceNotifyAll: problem selection failed')
    const u = users[idx]
    return { user: u, displayName: u.display_name ?? u.email ?? '—', channels: [] as typeof allChannels, problem: null as Awaited<ReturnType<typeof selectProblemForUser>> }
  })

  // Second pass: serial channel dispatch + result collection
  for (const { user, displayName, channels, problem } of userProblems) {
    if (!channels.length) {
      results.push({ userId: user.id, displayName, status: 'skipped', channels: [] })
      continue
    }

    if (!problem) {
      results.push({ userId: user.id, displayName, status: 'skipped', channels: [] })
      continue
    }

    const pushMsg: PushMessage = {
      title: problem.title,
      difficulty: problem.difficulty,
      leetcodeId: problem.leetcode_id,
      explanation: problem.explanation,
      url: `${APP_URL}/problems/${problem.slug}`,
      problemSlug: problem.slug,
      problemId: problem.problem_id,
    }

    const channelResults: ChannelResult[] = []
    let anySent = false

    for (const ch of channels) {
      const result = await dispatchToChannel(ch.channel_type, ch.channel_identifier, pushMsg)
      channelResults.push({
        type: ch.channel_type,
        success: result.success,
        error: result.success ? undefined : result.error?.slice(0, 200),
      })
      if (result.success) {
        anySent = true
      } else if (!result.success && !result.shouldRetry) {
        const { error: rpcErr } = await db.rpc('increment_channel_failures', { p_channel_id: ch.id })
        if (rpcErr) logger.warn({ channelId: ch.id, error: rpcErr.message }, 'Failed to increment channel failures')
      }
    }

    const userResult: NotifyUserResult = {
      userId: user.id,
      displayName,
      status: anySent ? 'success' : 'failed',
      channels: channelResults,
      problemTitle: problem.title,
    }
    results.push(userResult)

    if (anySent) {
      historyEntries.push({ user_id: user.id, problem_id: problem.problem_id })
      deliveredUserIds.push(user.id)
      if (problem.list_id && problem.sequence_number) {
        listPositionUpdates.push({ user_id: user.id, list_id: problem.list_id, sequence_number: problem.sequence_number })
      }
    }
  }

  if (historyEntries.length > 0) {
    const [historyResult, stampResult, ...rest] = await Promise.all([
      db.from('history').upsert(historyEntries, { onConflict: 'user_id,problem_id', ignoreDuplicates: true }),
      db.rpc('stamp_last_push_date', { p_user_ids: deliveredUserIds }),
      ...(listPositionUpdates.length > 0
        ? [db.rpc('advance_list_positions', {
            p_updates: listPositionUpdates.map(u => ({
              user_id: u.user_id,
              list_id: u.list_id,
              sequence_number: u.sequence_number,
            })),
          })]
        : []),
    ])
    const writeErrors: string[] = []
    if (historyResult.error) writeErrors.push(`History: ${historyResult.error.message}`)
    if (stampResult.error) writeErrors.push(`Stamp: ${stampResult.error.message}`)
    if (rest[0]?.error) writeErrors.push(`Positions: ${rest[0].error.message}`)
    if (writeErrors.length > 0) {
      // Log but don't throw — notifications are already sent.
      // Throwing here would hide per-user results from the admin UI.
      logger.error({ errors: writeErrors }, 'forceNotifyAll: post-dispatch writes partially failed')
    }
  }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/admin/push')
  const summary = {
    sent: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
  }
  return { results, summary }
}

// ── Channel Management ──────────────────────────────────────────

const channelIdSchema = z.string().uuid()

export async function resetChannelFailures(channelId: string) {
  const parsed = channelIdSchema.parse(channelId)
  return runAdminAction(
    'resetChannelFailures',
    async ({ db }) => {
      const { error } = await db
        .from('notification_channels')
        .update({ consecutive_send_failures: 0 })
        .eq('id', parsed)
      if (error) throw error
    },
    { revalidate: '/admin/channels', errorMessage: 'Failed to reset channel failures', logContext: { channelId } },
  )
}

export interface TestNotifyResult {
  success: boolean
  latencyMs: number
  error?: string
}

export async function testNotifyChannel(channelId: string): Promise<TestNotifyResult> {
  const parsed = channelIdSchema.parse(channelId)
  const { db } = await requireAdmin()

  const { data: channel, error: chErr } = await db
    .from('notification_channels')
    .select('id, user_id, channel_type, channel_identifier, users(id, active_mode, difficulty_min, difficulty_max, topic_filter)')
    .eq('id', parsed)
    .single()

  if (chErr || !channel) return { success: false, latencyMs: 0, error: 'Channel not found' }

  // Respect line_push_allowed — LINE free tier has 200 msg/month limit
  if (channel.channel_type === 'line') {
    const { data: userRow, error: userErr } = await db
      .from('users')
      .select('line_push_allowed')
      .eq('id', channel.user_id)
      .single()
    if (userErr || !userRow?.line_push_allowed) {
      return { success: false, latencyMs: 0, error: 'LINE push not allowed for this user (line_push_allowed = false)' }
    }
  }

  const user = channel.users as unknown as {
    id: string; active_mode: string
    difficulty_min: number; difficulty_max: number
    topic_filter: string[] | null
  }

  let problem: Awaited<ReturnType<typeof selectProblemForUser>>
  try {
    problem = await selectProblemForUser(
      {
        id: user.id,
        mode: user.active_mode as LearningMode,
        difficulty_min: user.difficulty_min,
        difficulty_max: user.difficulty_max,
        topic_filter: user.topic_filter ?? null,
      },
      db,
    )
  } catch (err) {
    logger.error({ userId: user.id, error: String(err) }, 'testNotifyChannel: problem selection failed')
    return { success: false, latencyMs: 0, error: 'Problem selection failed' }
  }

  if (!problem) return { success: false, latencyMs: 0, error: 'No problem available for this user' }

  const pushMsg: PushMessage = {
    title: problem.title,
    difficulty: problem.difficulty,
    leetcodeId: problem.leetcode_id,
    explanation: problem.explanation,
    url: `${APP_URL}/problems/${problem.slug}`,
    problemSlug: problem.slug,
    problemId: problem.problem_id,
  }

  // Test sends do NOT record history or advance list positions — purely diagnostic
  const start = Date.now()
  const result = await dispatchToChannel(channel.channel_type, channel.channel_identifier, pushMsg)
  const latencyMs = Date.now() - start

  if (!result.success) {
    logger.warn(
      { channelType: channel.channel_type, error: result.error?.slice(0, 200) },
      'testNotifyChannel: send failed',
    )
  }

  return {
    success: result.success,
    latencyMs,
    error: result.success ? undefined : result.error?.slice(0, 200),
  }
}
