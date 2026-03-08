'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { updateUser, getUserSettings } from '@/lib/repositories/user.repository'
import { deactivateAllLists, upsertListProgress } from '@/lib/repositories/list.repository'
import { toUtcHour } from '@/lib/utils/timezone'
import { timezoneSchema } from '@/lib/schemas/timezone'

// ── Push settings ──────────────────────────────────────────────────────────

const pushSchema = z.object({
  push_enabled: z.boolean(),
  push_hour: z.number().int().min(0).max(23),
})

export async function updatePushSettings(push_enabled: boolean, push_hour: number) {
  const { supabase, user } = await getAuthUser()
  pushSchema.parse({ push_enabled, push_hour })

  const current = await getUserSettings(supabase, user.id)
  const timezone = current?.timezone ?? 'Asia/Taipei'
  const push_hour_utc = toUtcHour(push_hour, timezone)

  await updateUser(supabase, user.id, { push_enabled, push_hour, push_hour_utc })
  revalidatePath('/settings')
  revalidatePath('/dashboard')
}

// ── Timezone ───────────────────────────────────────────────────────────────

const timezoneObjectSchema = z.object({
  timezone: timezoneSchema,
})

export async function updateTimezone(timezone: string) {
  const { supabase, user } = await getAuthUser()
  timezoneObjectSchema.parse({ timezone })

  const current = await getUserSettings(supabase, user.id)
  const push_hour = current?.push_hour ?? 9
  const push_hour_utc = toUtcHour(push_hour, timezone)

  await updateUser(supabase, user.id, { timezone, push_hour_utc })
  revalidatePath('/settings')
}

// ── Learning mode ──────────────────────────────────────────────────────────

const modeSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('list'),
    list_id: z.number().int().positive(),
  }),
  z.object({
    mode: z.literal('filter'),
    difficulty_min: z.number().int().min(0).max(3000),
    difficulty_max: z.number().int().min(0).max(3000),
    topic_filter: z.array(z.string().max(100)).max(50).nullable(),
  }).refine(d => d.difficulty_min <= d.difficulty_max, {
    message: 'difficulty_min must be <= difficulty_max',
  }),
])

export async function updateLearningMode(
  data:
    | { mode: 'list'; list_id: number }
    | { mode: 'filter'; difficulty_min: number; difficulty_max: number; topic_filter: string[] | null }
) {
  const { supabase, user } = await getAuthUser()
  modeSchema.parse(data)

  if (data.mode === 'list') {
    await updateUser(supabase, user.id, { active_mode: 'list' })
    await deactivateAllLists(supabase, user.id)
    await upsertListProgress(supabase, {
      user_id: user.id,
      list_id: data.list_id,
      is_active: true,
    })
  } else {
    await updateUser(supabase, user.id, {
      active_mode: 'filter',
      difficulty_min: data.difficulty_min,
      difficulty_max: data.difficulty_max,
      topic_filter: data.topic_filter,
    })
  }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
}

// ── Subscribe to list ────────────────────────────────────────────────────

const subscribeSchema = z.object({
  listId: z.number().int().positive(),
  startPosition: z.number().int().min(0).optional(),
})

export async function subscribeToList(listId: number, startPosition?: number) {
  const { supabase, user } = await getAuthUser()
  subscribeSchema.parse({ listId, startPosition })

  await updateUser(supabase, user.id, { active_mode: 'list' })
  await deactivateAllLists(supabase, user.id)

  const progressData: {
    user_id: string
    list_id: number
    is_active: boolean
    current_position?: number
  } = {
    user_id: user.id,
    list_id: listId,
    is_active: true,
  }

  if (startPosition !== undefined) {
    progressData.current_position = startPosition
  }

  await upsertListProgress(supabase, progressData)

  revalidatePath('/dashboard')
  revalidatePath('/settings/learning')
}

// ── Delete account (GDPR/PDPA) ────────────────────────────────────────────

export async function deleteAccount() {
  const { supabase, user } = await getAuthUser()

  const { createServiceClient } = await import('@/lib/supabase/server')
  const { logger } = await import('@/lib/logger')

  const adminDb = createServiceClient()

  // Delete auth user first — if this fails, DB data is still intact.
  const { error: authError } = await adminDb.auth.admin.deleteUser(user.id)
  if (authError) {
    logger.error({ error: authError, userId: user.id }, 'Failed to delete auth user')
    return { success: false as const, error: '刪除認證帳號失敗' }
  }

  // Then delete DB row — cascades to notification_channels, history,
  // feedback, and user_list_progress via ON DELETE CASCADE FKs.
  const { error: deleteError } = await adminDb
    .from('users')
    .delete()
    .eq('id', user.id)

  if (deleteError) {
    logger.error({ error: deleteError, userId: user.id }, 'Failed to delete user data')
    return { success: false as const, error: '刪除帳號資料失敗' }
  }

  logger.info({ userId: user.id }, 'User account deleted successfully')

  // Sign out (best-effort — auth user is already gone)
  await supabase.auth.signOut().catch(() => {})
  redirect('/')
}

// ── Export data ────────────────────────────────────────────────────────────

export async function exportData() {
  const { supabase, user } = await getAuthUser()

  const [historyRes, feedbackRes, progressRes] = await Promise.all([
    supabase.from('history').select('sent_at, problems(title, slug)').eq('user_id', user.id),
    supabase.from('feedback').select('problem_id, difficulty, content_score, created_at').eq('user_id', user.id),
    supabase.from('user_list_progress').select('current_position, is_active, curated_lists(name, slug)').eq('user_id', user.id),
  ])

  if (historyRes.error) {
    const { logger } = await import('@/lib/logger')
    logger.error({ error: historyRes.error }, 'exportData: failed to fetch history')
    throw new Error('Failed to export data')
  }
  if (feedbackRes.error) {
    const { logger } = await import('@/lib/logger')
    logger.error({ error: feedbackRes.error }, 'exportData: failed to fetch feedback')
    throw new Error('Failed to export data')
  }
  if (progressRes.error) {
    const { logger } = await import('@/lib/logger')
    logger.error({ error: progressRes.error }, 'exportData: failed to fetch progress')
    throw new Error('Failed to export data')
  }

  return {
    exported_at: new Date().toISOString(),
    history: historyRes.data ?? [],
    feedback: feedbackRes.data ?? [],
    list_progress: progressRes.data ?? [],
  }
}
