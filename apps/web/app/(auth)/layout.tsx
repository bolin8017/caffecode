import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Belt-and-suspenders auth guard — middleware handles the primary redirect,
// but this catches any edge cases where middleware is bypassed.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
