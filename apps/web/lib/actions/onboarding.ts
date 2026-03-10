'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { updateUser } from '@/lib/repositories/user.repository'
import { upsertListProgress } from '@/lib/repositories/list.repository'
import { toUtcHour } from '@/lib/utils/timezone'
import { timezoneSchema } from '@/lib/schemas/timezone'

const onboardingSchema = z.object({
  mode: z.enum(['list', 'filter']),
  list_id: z.number().int().positive().nullable(),
  difficulty_min: z.number().int().min(0).max(3000),
  difficulty_max: z.number().int().min(0).max(3000),
  timezone: timezoneSchema,
  push_hour: z.number().int().min(0).max(23),
}).refine(d => d.difficulty_min <= d.difficulty_max, {
  message: 'difficulty_min must be <= difficulty_max',
})

export async function completeOnboarding(data: {
  mode: 'list' | 'filter'
  list_id: number | null
  difficulty_min: number
  difficulty_max: number
  timezone: string
  push_hour: number
}) {
  const { supabase, user } = await getAuthUser()

  // Idempotency guard: if already onboarded, skip straight to redirect
  const { data: profile, error: fetchError } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()
  if (fetchError) {
    const { logger } = await import('@/lib/logger')
    logger.error({ error: fetchError, userId: user.id }, 'completeOnboarding: failed to fetch user')
    throw new Error('無法載入使用者資料')
  }
  if (profile?.onboarding_completed) {
    redirect('/garden')
  }

  onboardingSchema.parse(data)

  const push_hour_utc = toUtcHour(data.push_hour, data.timezone)

  try {
    await updateUser(supabase, user.id, {
      active_mode: data.mode,
      difficulty_min: data.difficulty_min,
      difficulty_max: data.difficulty_max,
      timezone: data.timezone,
      push_hour: data.push_hour,
      push_hour_utc,
      onboarding_completed: true,
    })

    if (data.mode === 'list' && data.list_id) {
      await upsertListProgress(supabase, {
        user_id: user.id,
        list_id: data.list_id,
        is_active: true,
        current_position: 0,
      })
    }
  } catch (err) {
    const { logger } = await import('@/lib/logger')
    logger.error({ error: String(err), userId: user.id }, 'completeOnboarding failed')
    throw new Error('新手引導完成失敗')
  }

  redirect('/garden')
}
