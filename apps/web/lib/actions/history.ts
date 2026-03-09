'use server'

import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { type SolveResult, EMPTY_SOLVE_RESULT, buildSolveResult } from '@/lib/utils/solve-result'

const problemIdSchema = z.number().int().positive()

export async function markSolved(problemId: number): Promise<SolveResult> {
  problemIdSchema.parse(problemId)

  const { supabase, user } = await getAuthUser()

  // Fetch history row WITH problem topics (needed for feedback)
  const { data: historyRow, error: historyErr } = await supabase
    .from('history')
    .select('id, sent_at, solved_at, problems(topics)')
    .eq('user_id', user.id)
    .eq('problem_id', problemId)
    .single()

  if (historyErr || !historyRow) {
    logger.error({ error: historyErr?.message, problemId }, 'markSolved history lookup failed')
    throw new Error('No push record found')
  }

  if (historyRow.solved_at) return EMPTY_SOLVE_RESULT

  // Fetch topic proficiency BEFORE marking solved (baseline for level-up detection)
  let beforeTopics: Awaited<ReturnType<typeof import('@/lib/repositories/garden.repository').getTopicProficiency>> = []
  try {
    const { getTopicProficiency } = await import('@/lib/repositories/garden.repository')
    beforeTopics = await getTopicProficiency(supabase, user.id)
  } catch {
    // Non-blocking: feedback will just show empty if this fails
  }

  // Atomic update with TOCTOU guard
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

  if (!updated || updated.length === 0) return EMPTY_SOLVE_RESULT

  // Best-effort badge check + build feedback
  let solveResult: SolveResult = EMPTY_SOLVE_RESULT
  try {
    const { checkAndAwardBadges } = await import('@/lib/repositories/badge.repository')
    const { getGardenSummary, computeLevel } = await import('@/lib/repositories/garden.repository')
    const { calculateStreak } = await import('@/lib/services/streak.service')

    const problemTopics = (historyRow.problems as unknown as { topics: string[] })?.topics ?? []

    const [summary, streakHistory, profileRow] = await Promise.all([
      getGardenSummary(supabase, user.id),
      supabase.from('history').select('solved_at').eq('user_id', user.id).not('solved_at', 'is', null).order('solved_at', { ascending: false }),
      supabase.from('users').select('timezone').eq('id', user.id).single(),
    ])

    const { data: streakData, error: streakError } = streakHistory
    if (streakError) {
      logger.warn({ error: streakError }, 'markSolved: streak query failed, using 0 for badge evaluation')
    }
    const userTimezone = profileRow.data?.timezone ?? 'Asia/Taipei'
    const streak = streakError ? 0 : calculateStreak(streakData ?? [], userTimezone)

    // Post-solve proficiency for badge check (beforeTopics + 1 for this problem's topics)
    const postTopics = beforeTopics.map(t => ({
      ...t,
      solvedCount: problemTopics.includes(t.topic) ? t.solvedCount + 1 : t.solvedCount,
      level: problemTopics.includes(t.topic)
        ? computeLevel(t.solvedCount + 1)
        : t.level,
    }))

    const newBadges = await checkAndAwardBadges(supabase, user.id, {
      totalSolves: summary.totalSolved,
      currentStreak: streak,
      topicLevels: postTopics.map(t => ({ topic: t.topic, level: t.level })),
      topicCount: postTopics.filter(t => t.solvedCount > 0).length,
    })

    const isFirstSolve = summary.totalSolved === 1
    solveResult = {
      ...buildSolveResult(beforeTopics, problemTopics, newBadges),
      firstSolve: isFirstSolve,
    }
  } catch {
    // Badge/feedback failure should never block the solve action
  }

  revalidatePath(`/problems/[slug]`, 'page')
  revalidatePath('/garden')
  revalidatePath('/dashboard')

  return solveResult
}
