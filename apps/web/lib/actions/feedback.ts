'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'

const feedbackSchema = z.object({
  problemId: z.number().int().positive(),
  difficulty: z.enum(['too_easy', 'just_right', 'too_hard']).optional(),
  contentScore: z.number().int().min(1).max(5).optional(),
})

export async function submitFeedback(
  problemId: number,
  difficulty?: 'too_easy' | 'just_right' | 'too_hard',
  contentScore?: number
) {
  feedbackSchema.parse({ problemId, difficulty, contentScore })

  const { supabase, user } = await getAuthUser()

  const { data: problem, error: checkError } = await supabase
    .from('problems')
    .select('id')
    .eq('id', problemId)
    .single()

  if (checkError || !problem) throw new Error('Problem not found')

  const { error } = await supabase.from('feedback').upsert(
    {
      user_id: user.id,
      problem_id: problemId,
      ...(difficulty !== undefined && { difficulty }),
      ...(contentScore !== undefined && { content_score: contentScore }),
    },
    { onConflict: 'user_id,problem_id' }
  )
  if (error) throw new Error(`Failed to submit feedback: ${error.message}`)

  // avg_score/score_count updated automatically by trg_feedback_update_scores
  if (contentScore !== undefined) {
    revalidatePath('/admin/content')
  }
}
