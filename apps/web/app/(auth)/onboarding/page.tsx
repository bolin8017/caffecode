import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from './onboarding-wizard'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '開始設定 — CaffeCode' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // If already onboarded, go to dashboard
  const { data: profile } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed) redirect('/dashboard')

  // Fetch all lists for step 2
  const serviceClient = createServiceClient()
  const { data: lists } = await serviceClient
    .from('curated_lists')
    .select('id, name, problem_count')
    .order('id')

  return <OnboardingWizard lists={lists ?? []} />
}
