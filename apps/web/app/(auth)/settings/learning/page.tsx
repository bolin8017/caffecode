import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LearningForm } from './learning-form'
import { getSuggestedRange } from '@/lib/repositories/user.repository'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '學習模式 — CaffeCode' }

export default function LearningPage() {
  return (
    <Suspense fallback={null}>
      <LearningPageBody />
    </Suspense>
  )
}

async function LearningPageBody() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const [profileRes, activeProgressRes, listsRes, suggestedRange, feedbackCountRes] =
    await Promise.all([
      supabase
        .from('users')
        .select('active_mode, difficulty_min, difficulty_max')
        .eq('id', user.id)
        .single(),
      supabase
        .from('user_list_progress')
        .select('list_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
      serviceClient
        .from('curated_lists')
        .select('id, name, slug, problem_count')
        .order('id'),
      getSuggestedRange(supabase, user.id),
      supabase
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('difficulty', 'is', null),
    ])

  if (!profileRes.data) redirect('/login')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">學習模式</h1>
        <p className="text-sm text-muted-foreground">選擇清單模式循序學習，或使用篩選模式隨機挑戰</p>
      </div>
      <LearningForm
        mode={profileRes.data.active_mode === 'filter' ? 'filter' : 'list'}
        lists={listsRes.data ?? []}
        activeListId={activeProgressRes.data?.list_id ?? null}
        difficultyMin={profileRes.data.difficulty_min ?? 0}
        difficultyMax={profileRes.data.difficulty_max ?? 3000}
        suggestedRange={suggestedRange}
        feedbackCount={feedbackCountRes.count ?? 0}
      />
    </div>
  )
}
