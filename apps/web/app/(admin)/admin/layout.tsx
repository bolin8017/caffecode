import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  LayoutDashboard, Zap, Radio,
  BookOpen, FileText, List,
  Users,
} from 'lucide-react'

export const metadata: Metadata = { title: 'Admin — CaffeCode' }

const NAV_GROUPS = [
  {
    label: 'Monitoring',
    links: [
      { href: '/admin',          label: 'Dashboard',    icon: LayoutDashboard },
      { href: '/admin/push',     label: 'Push Monitor', icon: Zap },
      { href: '/admin/channels', label: 'Channels',     icon: Radio },
    ],
  },
  {
    label: 'Content',
    links: [
      { href: '/admin/problems', label: 'Problems',     icon: BookOpen },
      { href: '/admin/content',  label: 'AI Content',   icon: FileText },
      { href: '/admin/lists',    label: 'Lists',        icon: List },
    ],
  },
  {
    label: 'Users',
    links: [
      { href: '/admin/users', label: 'User Management', icon: Users },
    ],
  },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Fresh DB verification for is_admin — do not trust header for auth
  const supabase = createServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: dbProfile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!dbProfile?.is_admin) redirect('/dashboard')

  // Header is display-only (name/avatar in sidebar) — safe to use for UI
  const encoded = (await headers()).get('x-user-profile')
  const profile = encoded
    ? JSON.parse(decodeURIComponent(encoded)) as { display_name: string | null }
    : null

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
        <div className="px-4 py-5 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
          <p className="text-sm font-medium mt-0.5 truncate">{profile?.display_name ?? user.email}</p>
        </div>
        <nav className="flex-1 py-3 px-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
              <p className="px-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <link.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-4 py-4 border-t">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
            ← 返回 Dashboard
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-8">{children}</main>
    </div>
  )
}
