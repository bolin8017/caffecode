import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { LoginForm } from './login-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '登入',
  description: '登入 CaffeCode，開始你的刷題之旅。',
  alternates: { canonical: '/login' },
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>
}) {
  return (
    <Suspense fallback={null}>
      <LoginPageBody searchParams={searchParams} />
    </Suspense>
  )
}

export async function LoginPageBody({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  const params = await searchParams
  return <LoginForm error={params.error} redirectTo={params.redirect} />
}
