import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AccountForm } from './account-form'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '帳號 — CaffeCode' }

export default function AccountPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">帳號</h1>
        <p className="text-sm text-muted-foreground">管理帳號資料與資料匯出</p>
      </div>
      <Suspense fallback={null}>
        <AccountGuard />
      </Suspense>
      <AccountForm />
    </div>
  )
}

async function AccountGuard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return null
}
