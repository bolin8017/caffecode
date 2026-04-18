import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { PostHogIdentify } from '@/components/posthog-identify'

// Belt-and-suspenders auth guard — proxy handles the primary redirect,
// but this catches any edge cases where proxy is bypassed.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Suspense fallback={null}>
        <AuthGuard />
      </Suspense>
      {children}
    </>
  )
}

async function AuthGuard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <PostHogIdentify userId={user.id} email={user.email ?? null} />
}
