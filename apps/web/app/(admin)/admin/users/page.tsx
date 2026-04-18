import { createServiceClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { LineToggle } from './line-toggle'
import { DeleteButton } from './delete-button'
import { PAGE_SIZE } from '@/lib/utils/filter-url'
import { sanitizeSearch } from '@/lib/utils/sanitize-search'
import { SearchInput, Pagination } from '@/components/data-table'

interface SearchParams {
  [key: string]: string | undefined
  q?: string
  page?: string
}

interface UserWithChannels {
  id: string
  email: string
  display_name: string | null
  push_enabled: boolean
  push_hour: number
  active_mode: string | null
  onboarding_completed: boolean
  is_admin: boolean | null
  line_push_allowed: boolean | null
  created_at: string
  notification_channels: Array<{ channel_type: string; is_verified: boolean }>
}

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  return (
    <Suspense fallback={null}>
      <AdminUsersPageBody searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminUsersPageBody({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const currentPage = Math.max(1, Number(params.page ?? '1'))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = createServiceClient()

  let query = supabase
    .from('users')
    .select(
      'id, email, display_name, push_enabled, push_hour, active_mode, onboarding_completed, is_admin, line_push_allowed, created_at, notification_channels(channel_type, is_verified)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (params.q) {
    const q = sanitizeSearch(params.q)
    query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
  }

  const { data, count } = await query
  const users = (data ?? []) as UserWithChannels[]
  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const { count: lineAllowedCount } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('line_push_allowed', true)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <span className="text-sm text-muted-foreground">{totalCount} total</span>
      </div>

      {/* LINE Quota Banner */}
      <div className="mb-4 rounded-lg border border-[#06C755]/30 bg-[#06C755]/5 px-4 py-3">
        <p className="text-sm font-medium text-[#06C755]">LINE 通知配額</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Free tier：200 則/月。目前 LINE 通知開啟用戶：
          <span className="font-semibold text-foreground ml-1">{lineAllowedCount ?? 0}</span> 人
          （≈ {(lineAllowedCount ?? 0) * 30} 則/月）
        </p>
      </div>

      <div className="mb-4">
        <SearchInput basePath="/admin/users" currentParams={params} placeholder="搜尋 email 或名稱..." />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-left px-4 py-2">Mode</th>
              <th className="text-left px-4 py-2">Push</th>
              <th className="text-left px-4 py-2">Channels</th>
              <th className="text-left px-4 py-2">LINE</th>
              <th className="text-left px-4 py-2">Onboarded</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Joined</th>
              <th className="text-left px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/20">
                <td className="px-4 py-2">
                  <p className="font-medium">{u.display_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-2 text-muted-foreground capitalize">{u.active_mode ?? '—'}</td>
                <td className="px-4 py-2">
                  {u.push_enabled ? (
                    <span className="text-xs text-green-600">✓ {String(u.push_hour).padStart(2, '0')}:00</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">off</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(u.notification_channels ?? []).map((ch, i) => (
                        <span
                          key={i}
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            ch.is_verified
                              ? 'border-green-200 text-green-700 bg-green-50'
                              : 'border-muted text-muted-foreground'
                          }`}
                        >
                          {ch.channel_type === 'telegram' ? 'Telegram'
                            : ch.channel_type === 'line' ? 'LINE'
                            : 'Email'}
                        </span>
                      ))}
                    {(u.notification_channels ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <LineToggle userId={u.id} allowed={u.line_push_allowed ?? false} />
                </td>
                <td className="px-4 py-2">
                  {u.onboarding_completed
                    ? <span className="text-xs text-green-600">✓</span>
                    : <span className="text-xs text-muted-foreground">pending</span>}
                </td>
                <td className="px-4 py-2">
                  {u.is_admin
                    ? <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">Admin</span>
                    : <span className="text-xs text-muted-foreground">User</span>}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString('zh-TW')}
                </td>
                <td className="px-4 py-2">
                  <DeleteButton userId={u.id} isAdmin={u.is_admin ?? false} />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                  {params.q ? '沒有符合條件的結果' : '尚無使用者'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/admin/users" currentParams={params} />
    </div>
  )
}
