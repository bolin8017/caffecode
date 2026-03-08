import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeTopics } from '@caffecode/shared'

export type GrowthStage = 0 | 1 | 2 | 3 | 4

export interface TopicProficiency {
  topic: string
  solvedCount: number
  totalReceived: number
  stage: GrowthStage
  level: number
}

export function computeLevel(solvedCount: number): number {
  if (solvedCount === 0) return 0
  if (solvedCount <= 2) return 1
  if (solvedCount <= 5) return 2
  if (solvedCount <= 10) return 3
  return 4 + Math.floor((solvedCount - 11) / 5)
}

export function toStage(solvedCount: number): GrowthStage {
  if (solvedCount === 0) return 0
  if (solvedCount <= 2) return 1
  if (solvedCount <= 5) return 2
  if (solvedCount <= 10) return 3
  return 4
}

export async function getTopicProficiency(
  supabase: SupabaseClient,
  userId: string
): Promise<TopicProficiency[]> {
  const { data, error } = await supabase.rpc('get_topic_proficiency', { p_user_id: userId })
  if (error) throw new Error(`Failed to fetch topic proficiency: ${error.message}`)

  const rawRows = data as { topic: string; solved_count: number; total_received: number }[]
  const normalized = normalizeTopics(rawRows)

  return normalized.map(row => ({
    topic: row.topic,
    solvedCount: row.solved_count,
    totalReceived: row.total_received,
    stage: toStage(row.solved_count),
    level: computeLevel(row.solved_count),
  }))
}

export async function getGardenSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<{ totalSolved: number; totalReceived: number }> {
  const [receivedRes, solvedRes] = await Promise.all([
    supabase.from('history').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('history').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('solved_at', 'is', null),
  ])
  if (receivedRes.error) throw new Error(`Failed to fetch garden summary: ${receivedRes.error.message}`)
  if (solvedRes.error) throw new Error(`Failed to fetch garden summary: ${solvedRes.error.message}`)
  return {
    totalReceived: receivedRes.count ?? 0,
    totalSolved: solvedRes.count ?? 0,
  }
}
