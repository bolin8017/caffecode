import type { SupabaseClient } from '@supabase/supabase-js'

export interface RecentHistoryEntry {
  sent_at: string
  problems: {
    title: string
    slug: string
    difficulty: string
  } | null
}

export async function getRecentHistory(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<RecentHistoryEntry[]> {
  const { data, error } = await supabase
    .from('history')
    .select('sent_at, problems(title, slug, difficulty)')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Failed to fetch recent history: ${error.message}`)
  return (data ?? []) as unknown as RecentHistoryEntry[]
}

export async function getStreakHistory(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<{ sent_at: string }[]> {
  const { data, error } = await supabase
    .from('history')
    .select('sent_at')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Failed to fetch streak history: ${error.message}`)
  return data ?? []
}
