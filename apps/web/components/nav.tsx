import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Button } from './ui/button'
import { UserMenu } from './user-menu'

interface UserProfile {
  display_name: string | null
  avatar_url: string | null
  is_admin: boolean
}

interface NavProps {
  userProfile: UserProfile | null
}

export async function Nav({ userProfile }: NavProps) {
  // Still need to check auth state for login/logout button rendering
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const displayName = userProfile?.display_name ?? user?.email?.split('@')[0] ?? '用戶'

  return (
    <nav className="border-b bg-background sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Image src="/logo.png" alt="CaffeCode" width={28} height={28} />
          CaffeCode
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/problems"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            題庫
          </Link>
          <Link
            href="/lists"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            學習清單
          </Link>

          {user && userProfile && (
            <Link
              href="/garden"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              咖啡園
            </Link>
          )}

          {user && userProfile ? (
            <UserMenu
              displayName={displayName}
              avatarUrl={userProfile.avatar_url}
              isAdmin={userProfile.is_admin}
            />
          ) : (
            <Button asChild size="sm">
              <Link href="/login">登入</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
