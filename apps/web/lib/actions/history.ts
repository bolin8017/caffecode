'use server'

import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

const problemIdSchema = z.number().int().positive()

export async function markSolved(problemId: number): Promise<void> {
  problemIdSchema.parse(problemId)

  const { supabase, user } = await getAuthUser()

  const { data: historyRow, error: historyErr } = await supabase
    .from('history')
    .select('id, sent_at, solved_at')
    .eq('user_id', user.id)
    .eq('problem_id', problemId)
    .single()

  if (historyErr || !historyRow) throw new Error('No push record found')

  if (historyRow.solved_at) return

  const { error: updateErr } = await supabase
    .from('history')
    .update({ solved_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('problem_id', problemId)

  if (updateErr) throw new Error(`Mark failed: ${updateErr.message}`)

  // Best-effort badge check (don't block solve on failure)
  try {
    const { getTopicProficiency, getGardenSummary } = await import('@/lib/repositories/garden.repository')
    const { checkAndAwardBadges } = await import('@/lib/repositories/badge.repository')
    const { calculateStreak } = await import('@/lib/services/streak.service')

    const [topics, summary, streakHistory] = await Promise.all([
      getTopicProficiency(supabase, user.id),
      getGardenSummary(supabase, user.id),
      supabase.from('history').select('sent_at').eq('user_id', user.id).order('sent_at', { ascending: false }),
    ])

    const streak = calculateStreak(streakHistory.data ?? [])

    await checkAndAwardBadges(supabase, user.id, {
      totalSolves: summary.totalSolved,
      currentStreak: streak,
      topicLevels: topics.map(t => ({ topic: t.topic, level: t.level })),
      topicCount: topics.filter(t => t.solvedCount > 0).length,
    })
  } catch {
    // Badge check failure should never block the solve action
  }

  revalidatePath(`/problems/[slug]`, 'page')
}
