import type { SupabaseClient } from '@supabase/supabase-js'
import type { Difficulty, SelectedProblem } from '../types/push.js'
import { logger } from '../push/push.logger.js'

// Shape returned when a problem row is joined with problem_content via
// Supabase's relational select. Narrowed from `unknown` by `toProblemRow`
// so any schema drift is logged and skipped at the repository boundary
// instead of propagating as a runtime crash inside the push pipeline.
interface JoinedProblemRow {
  slug: string
  title: string
  difficulty: Difficulty
  leetcode_id: number
  problem_content: { explanation: string } | null
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'Easy' || value === 'Medium' || value === 'Hard'
}

/**
 * Narrows a Supabase join payload to `JoinedProblemRow`. Returns `null` both
 * when the caller passed `null`/`undefined` (no row found) AND when the
 * payload's shape doesn't match — but in the latter case we log a warning so
 * schema drift is visible in production logs instead of silently skipping
 * problems.
 */
function toProblemRow(value: unknown, context: string): JoinedProblemRow | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    logger.warn({ context, type: typeof value }, 'toProblemRow: expected object, got non-object')
    return null
  }
  const v = value as Record<string, unknown>
  if (typeof v.slug !== 'string' || typeof v.title !== 'string') {
    logger.warn({ context, keys: Object.keys(v) }, 'toProblemRow: missing slug/title')
    return null
  }
  if (typeof v.leetcode_id !== 'number' || !isDifficulty(v.difficulty)) {
    logger.warn(
      { context, leetcode_id: v.leetcode_id, difficulty: v.difficulty },
      'toProblemRow: invalid leetcode_id or difficulty',
    )
    return null
  }

  // problem_content is either null (no content row) or { explanation: string }
  let content: JoinedProblemRow['problem_content'] = null
  if (v.problem_content != null) {
    if (typeof v.problem_content !== 'object') {
      logger.warn({ context }, 'toProblemRow: problem_content is not an object')
      return null
    }
    const c = v.problem_content as Record<string, unknown>
    if (typeof c.explanation !== 'string') {
      logger.warn({ context }, 'toProblemRow: problem_content.explanation missing or not a string')
      return null
    }
    content = { explanation: c.explanation }
  }

  return {
    slug: v.slug,
    title: v.title,
    difficulty: v.difficulty,
    leetcode_id: v.leetcode_id,
    problem_content: content,
  }
}

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

  const problem = toProblemRow(listProblem.problems, `list=${listId} seq=${nextSeq}`)
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

  // Reuse toProblemRow but `problems.id` is the primary key (not part of the
  // narrowed shape). Pass the other joined fields through the type guard so
  // the same drift-logging applies here.
  const content = toProblemRow(
    {
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty,
      leetcode_id: row.leetcode_id,
      problem_content: row.problem_content,
    },
    `problemId=${problemId}`,
  )
  if (!content || !content.problem_content) return null

  return {
    problem_id: row.id,
    leetcode_id: content.leetcode_id,
    slug: content.slug,
    title: content.title,
    difficulty: content.difficulty,
    explanation: content.problem_content.explanation,
  }
}
