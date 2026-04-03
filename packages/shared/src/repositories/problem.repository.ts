import type { SupabaseClient } from '@supabase/supabase-js'
import type { Difficulty, SelectedProblem } from '../types/push.js'

export async function getListProblemAtPosition(
  db: SupabaseClient,
  userId: string
): Promise<{ list_id: number; current_position: number } | null> {
  const { data, error } = await db
    .from('user_list_progress')
    .select('list_id, current_position')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()
  // PGRST116 = "no rows returned" — legitimate for users with no active list
  if (error && error.code !== 'PGRST116') {
    throw new Error(`getListProblemAtPosition: query failed: ${error.message}`)
  }
  if (!data) return null
  return data
}

export async function getProblemAtListPosition(
  db: SupabaseClient,
  listId: number,
  currentPosition: number
): Promise<SelectedProblem | null> {
  // current_position is the last-sent sequence_number (0 = nothing sent yet).
  // Next problem to send is at sequence_number = current_position + 1.
  const nextSeq = currentPosition + 1

  const { data: listProblem, error } = await db
    .from('list_problems')
    .select('problem_id, sequence_number, problems(slug, title, difficulty, leetcode_id, problem_content(explanation))')
    .eq('list_id', listId)
    .eq('sequence_number', nextSeq)
    .single()

  // PGRST116 = "no rows returned" — list completed (no more problems at this position)
  if (error && error.code !== 'PGRST116') {
    throw new Error(`getProblemAtListPosition: query failed: ${error.message}`)
  }
  if (!listProblem) return null

  const problem = listProblem.problems as unknown as {
    slug: string
    title: string
    difficulty: Difficulty
    leetcode_id: number
    problem_content: { explanation: string } | null
  } | null

  if (!problem || !problem.problem_content) return null

  return {
    problem_id: listProblem.problem_id,
    leetcode_id: problem.leetcode_id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    explanation: problem.problem_content.explanation,
    list_id: listId,
    sequence_number: nextSeq,
  }
}

export async function getUnsentProblemIds(
  db: SupabaseClient,
  userId: string,
  diffMin: number,
  diffMax: number,
  topic: string[] | null
): Promise<number[]> {
  const { data, error } = await db.rpc('get_unsent_problem_ids_for_user', {
    p_user_id: userId,
    p_diff_min: diffMin,
    p_diff_max: diffMax,
    p_topic: topic,
  })
  if (error) {
    throw new Error(`getUnsentProblemIds: RPC failed: ${error.message}`)
  }
  // RPC returns TABLE(problem_id integer) -> Supabase gives [{problem_id: N}, ...]
  return ((data ?? []) as Array<{ problem_id: number }>).map(row => row.problem_id)
}

export async function getProblemById(
  db: SupabaseClient,
  problemId: number
): Promise<SelectedProblem | null> {
  const { data: row, error } = await db
    .from('problems')
    .select('id, slug, title, difficulty, leetcode_id, problem_content(explanation)')
    .eq('id', problemId)
    .single()

  // PGRST116 = "no rows returned" — problem not found
  if (error && error.code !== 'PGRST116') {
    throw new Error(`getProblemById: query failed: ${error.message}`)
  }
  if (!row) return null

  const content = row.problem_content as unknown as { explanation: string } | null
  if (!content) return null

  return {
    problem_id: row.id,
    leetcode_id: row.leetcode_id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty as Difficulty,
    explanation: content.explanation,
  }
}
