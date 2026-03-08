import type { SupabaseClient } from '@supabase/supabase-js'
import type { SelectedProblem } from '../types/push.js'
import {
  getListProblemAtPosition,
  getProblemAtListPosition,
  getUnsentProblemIds,
  getProblemById,
} from '../repositories/problem.repository.js'

interface ProblemSelectionContext {
  id: string
  mode: 'list' | 'filter'
  difficulty_min: number
  difficulty_max: number
  topic_filter?: string[] | null
}

export async function selectProblemForUser(
  user: ProblemSelectionContext,
  supabase: SupabaseClient
): Promise<SelectedProblem | null> {
  if (user.mode === 'list') {
    return selectListModeProblem(user, supabase)
  }
  return selectFilterModeProblem(user, supabase)
}

async function selectListModeProblem(
  user: ProblemSelectionContext,
  supabase: SupabaseClient
): Promise<SelectedProblem | null> {
  const progress = await getListProblemAtPosition(supabase, user.id)
  if (!progress) return null
  return getProblemAtListPosition(supabase, progress.list_id, progress.current_position)
}

async function selectFilterModeProblem(
  user: ProblemSelectionContext,
  supabase: SupabaseClient
): Promise<SelectedProblem | null> {
  const unsentIds = await getUnsentProblemIds(
    supabase,
    user.id,
    user.difficulty_min,
    user.difficulty_max,
    user.topic_filter ?? null
  )

  if (unsentIds.length === 0) return null

  const problemId = unsentIds[Math.floor(Math.random() * unsentIds.length)]
  return getProblemById(supabase, problemId)
}
