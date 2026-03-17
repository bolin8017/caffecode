import type { SupabaseClient } from '@supabase/supabase-js'

export interface RecentHistoryEntry {
  problem_id: number
  sent_at: string
  solved_at: string | null
  skipped_at: string | null
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
    .select('problem_id, sent_at, solved_at, skipped_at, problems(title, slug, difficulty)')
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
): Promise<{ solved_at: string }[]> {
  const { data, error } = await supabase
    .from('history')
    .select('solved_at')
    .eq('user_id', userId)
    .not('solved_at', 'is', null)
    .order('solved_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Failed to fetch streak history: ${error.message}`)
  return (data ?? []) as { solved_at: string }[]
}

export async function getSolvedProblemIds(
  supabase: SupabaseClient,
  userId: string,
  problemIds: number[]
): Promise<Set<number>> {
  if (problemIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('history')
    .select('problem_id')
    .eq('user_id', userId)
    .not('solved_at', 'is', null)
    .in('problem_id', problemIds)

  if (error) throw new Error(`Failed to fetch solved problem IDs: ${error.message}`)
  return new Set((data ?? []).map((r: { problem_id: number }) => r.problem_id))
}
