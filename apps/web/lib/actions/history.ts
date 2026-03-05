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

  revalidatePath(`/problems/[slug]`, 'page')
}
