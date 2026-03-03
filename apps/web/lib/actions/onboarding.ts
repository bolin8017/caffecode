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
  difficulty_min: z.number().int().min(0),
  difficulty_max: z.number().int().min(0),
  timezone: timezoneSchema,
  push_hour: z.number().int().min(0).max(23),
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

  onboardingSchema.parse(data)

  const push_hour_utc = toUtcHour(data.push_hour, data.timezone)

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

  redirect('/dashboard')
}
