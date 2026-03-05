'use server'

import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

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

  if (historyErr || !historyRow) {
    logger.error({ error: historyErr?.message, problemId }, 'markSolved history lookup failed')
    throw new Error('No push record found')
  }

  if (historyRow.solved_at) return

  const { data: updated, error: updateErr } = await supabase
    .from('history')
    .update({ solved_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('problem_id', problemId)
    .is('solved_at', null)
    .select('id')

  if (updateErr) {
    logger.error({ error: updateErr.message, problemId }, 'markSolved update failed')
    throw new Error('Failed to mark problem as solved')
  }

  // If no rows matched, another concurrent call already solved it — return silently
  if (!updated || updated.length === 0) return

  // Best-effort badge check (don't block solve on failure)
  try {
    const { getTopicProficiency, getGardenSummary } = await import('@/lib/repositories/garden.repository')
    const { checkAndAwardBadges } = await import('@/lib/repositories/badge.repository')
    const { calculateStreak } = await import('@/lib/services/streak.service')

    const [topics, summary, streakHistory] = await Promise.all([
      getTopicProficiency(supabase, user.id),
      getGardenSummary(supabase, user.id),
      supabase.from('history').select('solved_at').eq('user_id', user.id).not('solved_at', 'is', null).order('solved_at', { ascending: false }),
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
  revalidatePath('/garden')
  revalidatePath('/dashboard')
}
