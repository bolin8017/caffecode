import type { SupabaseClient } from '@supabase/supabase-js'
import { computeSuggestedRange } from '@/lib/utils/rating-calibration'

export interface UserDashboard {
  display_name: string | null
  active_mode: 'list' | 'filter'
  push_enabled: boolean
  push_hour: number
  difficulty_min: number
  difficulty_max: number
  timezone: string
}

export interface UserSettings {
  push_enabled: boolean
  push_hour: number
  timezone: string
  line_push_allowed: boolean
}

export async function getUserDashboard(
  supabase: SupabaseClient,
  userId: string
): Promise<UserDashboard | null> {
  const { data, error } = await supabase
    .from('users')
    .select('display_name, active_mode, push_enabled, push_hour, difficulty_min, difficulty_max, timezone')
    .eq('id', userId)
    .single()
  if (error) throw new Error(`Failed to fetch user dashboard: ${error.message}`)
  return data
}

export async function getUserSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('users')
    .select('push_enabled, push_hour, timezone, line_push_allowed')
    .eq('id', userId)
    .single()
  if (error) throw new Error(`Failed to fetch user settings: ${error.message}`)
  return data
}

export async function updateUser(
  supabase: SupabaseClient,
  userId: string,
  data: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('users').update(data).eq('id', userId)
  if (error) throw new Error(`Failed to update user: ${error.message}`)
}

export async function getSuggestedRange(
  supabase: SupabaseClient,
  userId: string
): Promise<{ min: number; max: number } | null> {
  const { data, error } = await supabase
    .from('feedback')
    .select('difficulty, problems(rating)')
    .eq('user_id', userId)
    .not('difficulty', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data) return null

  const signals = data
    .map((row) => {
      const problem = row.problems as unknown as { rating: number | null } | null
      return {
        difficulty: row.difficulty as string,
        rating: problem?.rating ?? null,
      }
    })
    .filter((s): s is { difficulty: string; rating: number } => s.rating !== null)

  return computeSuggestedRange(signals)
}
