'use server'

import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

const problemIdSchema = z.number().int().positive()

export async function markSolved(problemId: number): Promise<void> {
  problemIdSchema.parse(problemId)

  const { supabase, user } = await getAuthUser()

  // 驗證 history row 存在（用戶必須收過這道題）
  const { data: historyRow, error: historyErr } = await supabase
    .from('history')
    .select('id, sent_at, solved_at')
    .eq('user_id', user.id)
    .eq('problem_id', problemId)
    .single()

  if (historyErr || !historyRow) throw new Error('未找到推送記錄')

  // 驗證 feedback 存在（防濫用：需先評分才能標記）
  const { data: feedbackRow, error: feedbackErr } = await supabase
    .from('feedback')
    .select('id')
    .eq('user_id', user.id)
    .eq('problem_id', problemId)
    .single()

  if (feedbackErr || !feedbackRow) throw new Error('請先送出題目評分（難度感受或星星評分）')

  // 冪等更新：solved_at 只寫一次
  if (historyRow.solved_at) return  // 已經標記過，直接返回

  const { error: updateErr } = await supabase
    .from('history')
    .update({ solved_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('problem_id', problemId)

  if (updateErr) throw new Error(`標記失敗：${updateErr.message}`)

  revalidatePath(`/problems/[slug]`, 'page')
}
