import type { SupabaseClient } from '@supabase/supabase-js'
import { computeTopicLevel, normalizeTopics } from '@caffecode/shared'
import type { TopicLevel } from '@caffecode/shared'

export interface TopicProficiency extends TopicLevel {
  topic: string
  totalReceived: number
}

export async function getTopicProficiency(
  supabase: SupabaseClient,
  userId: string
): Promise<TopicProficiency[]> {
  const { data, error } = await supabase.rpc('get_topic_proficiency', { p_user_id: userId })
  if (error) throw new Error(`Failed to fetch topic proficiency: ${error.message}`)

  const rawRows = data as { topic: string; solved_count: number; total_received: number }[]
  const normalized = normalizeTopics(rawRows)

  return normalized
    .map(row => ({
      topic: row.topic,
      totalReceived: row.total_received,
      ...computeTopicLevel(row.solved_count),
    }))
    .sort((a, b) => b.solvedCount - a.solvedCount || b.totalReceived - a.totalReceived)
}

export async function getGardenSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<{ totalSolved: number; totalReceived: number }> {
  const { data, error } = await supabase
    .from('history')
    .select('solved_at')
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to fetch garden summary: ${error.message}`)

  const rows = data ?? []
  return {
    totalReceived: rows.length,
    totalSolved: rows.filter(r => r.solved_at !== null).length,
  }
}
