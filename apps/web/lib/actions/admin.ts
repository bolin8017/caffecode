'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import {
  sendTelegramMessage,
  sendLineMessage,
  sendEmailMessage,
  selectProblemForUser,
  type PushMessage,
  type SendResult,
} from '@caffecode/shared'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError) throw new Error(`Failed to verify admin status: ${profileError.message}`)
  if (!profile?.is_admin) throw new Error('Forbidden')
  return createServiceClient()
}

// ── Problems ───────────────────────────────────────────────────

const problemSchema = z.object({
  leetcode_id: z.number().int().positive(),
  title: z.string().min(1),
  slug: z.string().min(1),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  rating: z.number().nullable().optional(),
  topics: z.array(z.string()).default([]),
})

export async function createProblem(data: z.infer<typeof problemSchema>) {
  const db = await requireAdmin()
  const parsed = problemSchema.parse(data)
  const { error } = await db.from('problems').insert(parsed)
  if (error) throw new Error(`Failed to create problem: ${error.message}`)
  revalidatePath('/admin/problems')
}

export async function updateProblem(id: number, data: Partial<z.infer<typeof problemSchema>>) {
  z.number().int().positive().parse(id)
  const parsed = problemSchema.partial().parse(data)
  const db = await requireAdmin()
  const { error } = await db.from('problems').update(parsed).eq('id', id)
  if (error) throw new Error(`Failed to update problem: ${error.message}`)
  revalidatePath('/admin/problems')
}

export async function deleteProblem(id: number) {
  z.number().int().positive().parse(id)
  const db = await requireAdmin()
  const { error } = await db.from('problems').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete problem: ${error.message}`)
  revalidatePath('/admin/problems')
}

export async function bulkImportProblems(
  listSlug: string,
  listName: string,
  problems: z.infer<typeof problemSchema>[]
) {
  const db = await requireAdmin()

  // Upsert list
  const { data: list } = await db
    .from('curated_lists')
    .upsert({ slug: listSlug, name: listName }, { onConflict: 'slug' })
    .select('id')
    .single()

  if (!list) throw new Error('Failed to upsert list')

  // Upsert problems
  const rows = problems.map(p => problemSchema.parse(p))
  const { data: upserted } = await db
    .from('problems')
    .upsert(rows, { onConflict: 'leetcode_id' })
    .select('id, leetcode_id')

  if (!upserted) throw new Error('Failed to upsert problems')

  // Build list_problems (sequence_number is 1-based)
  const idMap = new Map(upserted.map(r => [r.leetcode_id, r.id]))
  const listProblems = rows.map((p, i) => ({
    list_id: list.id,
    problem_id: idMap.get(p.leetcode_id)!,
    sequence_number: i + 1,
  })).filter(r => r.problem_id !== undefined)

  const { error: listProblemsError } = await db
    .from('list_problems')
    .upsert(listProblems, { onConflict: 'list_id,problem_id' })
  if (listProblemsError) throw new Error(`Failed to upsert list problems: ${listProblemsError.message}`)

  // Update problem_count
  const { error: countError } = await db
    .from('curated_lists')
    .update({ problem_count: listProblems.length })
    .eq('id', list.id)
  if (countError) throw new Error(`Failed to update problem count: ${countError.message}`)

  revalidatePath('/admin/problems')
  revalidatePath('/admin/lists')
  return { imported: listProblems.length }
}

// ── Content ────────────────────────────────────────────────────

const contentSchema = z.object({
  explanation: z.string().min(1),
  solution_code: z.string().min(1),
  complexity_analysis: z.string().min(1),
  pseudocode: z.string().nullable().optional(),
  alternative_approaches: z.string().nullable().optional(),
  follow_up: z.string().nullable().optional(),
})

export async function updateContent(problemId: number, data: z.infer<typeof contentSchema>) {
  z.number().int().positive().parse(problemId)
  const db = await requireAdmin()
  const parsed = contentSchema.parse(data)
  const { error } = await db
    .from('problem_content')
    .upsert({ problem_id: problemId, ...parsed, needs_regeneration: false }, { onConflict: 'problem_id' })
  if (error) throw new Error(`Failed to update content: ${error.message}`)
  revalidatePath('/admin/content')
  revalidatePath(`/problems`)
}

export async function flagForRegeneration(problemId: number) {
  z.number().int().positive().parse(problemId)
  const db = await requireAdmin()
  const { error } = await db
    .from('problem_content')
    .update({ needs_regeneration: true })
    .eq('problem_id', problemId)
  if (error) throw new Error(`Failed to flag for regeneration: ${error.message}`)
  revalidatePath('/admin/content')
}

export async function unflagRegeneration(problemId: number) {
  z.number().int().positive().parse(problemId)
  const db = await requireAdmin()
  const { error } = await db
    .from('problem_content')
    .update({ needs_regeneration: false })
    .eq('problem_id', problemId)
  if (error) throw new Error(`Failed to unflag regeneration: ${error.message}`)
  revalidatePath('/admin/content')
}

export async function setLinePushAllowed(userId: string, allowed: boolean) {
  z.string().uuid().parse(userId)
  z.boolean().parse(allowed)
  const db = await requireAdmin()
  const { error } = await db.from('users').update({ line_push_allowed: allowed }).eq('id', userId)
  if (error) throw new Error(`Failed to update LINE push allowed: ${error.message}`)
  revalidatePath('/admin/users')
}

export async function deleteUser(userId: string) {
  z.string().uuid().parse(userId)
  const db = await requireAdmin()
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
  msg: PushMessage
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
  const db = await requireAdmin()

  const { data: users, error: usersError } = await db
    .from('users')
    .select('id, display_name, email, active_mode, difficulty_min, difficulty_max, topic_filter, line_push_allowed')
    .eq('push_enabled', true)

  if (usersError || !users?.length) return { results: [], summary: { sent: 0, failed: 0, skipped: 0 } }

  const { data: allChannels, error: channelsError } = await db
    .from('notification_channels')
    .select('id, user_id, channel_type, channel_identifier')
    .in('user_id', users.map(u => u.id))
    .eq('is_verified', true)
    .lt('consecutive_send_failures', 3)

  if (channelsError) return { results: [], summary: { sent: 0, failed: 0, skipped: 0 } }

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

  for (const user of users) {
    const displayName = user.display_name ?? user.email ?? '—'
    const channels = (channelsByUser.get(user.id) ?? []).filter(
      ch => ch.channel_type !== 'line' || user.line_push_allowed
    )

    if (!channels.length) {
      results.push({ userId: user.id, displayName, status: 'skipped', channels: [] })
      continue
    }

    const problem = await selectProblemForUser(
      {
        id: user.id,
        mode: user.active_mode as 'list' | 'filter',
        difficulty_min: user.difficulty_min,
        difficulty_max: user.difficulty_max,
        topic_filter: user.topic_filter ?? null,
      },
      db
    )

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
        error: result.error,
      })
      if (result.success) {
        anySent = true
      } else if (!result.shouldRetry) {
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
    if (historyResult.error) logger.warn({ error: historyResult.error.message }, 'Failed to upsert history in forceNotifyAll')
    if (stampResult.error) logger.warn({ error: stampResult.error.message }, 'Failed to stamp push date in forceNotifyAll')
    if (rest[0]?.error) logger.warn({ error: rest[0].error.message }, 'Failed to advance list positions in forceNotifyAll')
  }

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
  const db = await requireAdmin()
  const { error } = await db
    .from('notification_channels')
    .update({ consecutive_send_failures: 0 })
    .eq('id', parsed)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/channels')
}

export interface TestNotifyResult {
  success: boolean
  latencyMs: number
  error?: string
}

export async function testNotifyChannel(channelId: string): Promise<TestNotifyResult> {
  const parsed = channelIdSchema.parse(channelId)
  const db = await requireAdmin()

  const { data: channel, error: chErr } = await db
    .from('notification_channels')
    .select('id, user_id, channel_type, channel_identifier, users(id, active_mode, difficulty_min, difficulty_max, topic_filter)')
    .eq('id', parsed)
    .single()

  if (chErr || !channel) return { success: false, latencyMs: 0, error: 'Channel not found' }

  const user = channel.users as unknown as {
    id: string; active_mode: string
    difficulty_min: number; difficulty_max: number
    topic_filter: string[] | null
  }

  const problem = await selectProblemForUser(
    {
      id: user.id,
      mode: user.active_mode as 'list' | 'filter',
      difficulty_min: user.difficulty_min,
      difficulty_max: user.difficulty_max,
      topic_filter: user.topic_filter ?? null,
    },
    db
  )

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
      'testNotifyChannel: send failed'
    )
  }

  return {
    success: result.success,
    latencyMs,
    error: result.error,
  }
}
