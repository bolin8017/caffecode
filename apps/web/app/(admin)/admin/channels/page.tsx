import { createServiceClient } from '@/lib/supabase/server'
import { ChannelActions } from './channel-actions'
import { PAGE_SIZE } from '@/lib/utils/filter-url'
import { FilterChips, SortableHeader, Pagination } from '@/components/data-table'

type SortKey = 'failures' | 'updated'
type SortDir = 'asc' | 'desc'

interface SearchParams {
  [key: string]: string | undefined
  status?: string
  type?: string
  sort?: string
  dir?: string
  page?: string
}

export default async function AdminChannelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const statusFilter = params.status ?? 'all'
  const typeFilter = params.type ?? 'all'
  const sortKey: SortKey = params.sort === 'updated' ? 'updated' : 'failures'
  const sortDir: SortDir = params.dir === 'asc' ? 'asc' : 'desc'
  const currentPage = Math.max(1, Number(params.page ?? '1'))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = createServiceClient()
  const basePath = '/admin/channels'

  // Single query — channels table is small (<500 rows), so fetch all + JS filter
  // is faster than 13 separate count queries. Revisit when channels exceed ~500.
  const { data: allChannels } = await supabase
    .from('notification_channels')
    .select('id, user_id, channel_type, is_verified, consecutive_send_failures, updated_at, users(display_name, email)')
    .order('consecutive_send_failures', { ascending: false })

  const all = allChannels ?? []

  // Compute stats from full array (no extra queries needed)
  const TYPES = ['telegram', 'line', 'email'] as const
  const stats = TYPES.map(type => ({
    type,
    verified: all.filter(c => c.channel_type === type && c.is_verified).length,
    total: all.filter(c => c.channel_type === type).length,
    failing: all.filter(c => c.channel_type === type && c.consecutive_send_failures >= 3).length,
  }))

  // Filter
  const filtered = all
    .filter(ch => {
      if (statusFilter === 'failing') return ch.consecutive_send_failures >= 3
      if (statusFilter === 'unverified') return !ch.is_verified
      return true
    })
    .filter(ch => typeFilter === 'all' || ch.channel_type === typeFilter)

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const diff = sortKey === 'updated'
      ? new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      : a.consecutive_send_failures - b.consecutive_send_failures
    return sortDir === 'asc' ? diff : -diff
  })

  // Paginate
  const totalCount = sorted.length
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const channels = sorted.slice(offset, offset + PAGE_SIZE)

  const statusOptions = [
    { value: 'all', label: `全部 (${all.length})` },
    { value: 'failing', label: `失敗 (${all.filter(c => c.consecutive_send_failures >= 3).length})` },
    { value: 'unverified', label: `未驗證 (${all.filter(c => !c.is_verified).length})` },
  ]

  const typeOptions = [
    { value: 'all', label: '所有類型' },
    ...stats.filter(s => s.total > 0).map(s => ({
      value: s.type,
      label: s.type.charAt(0).toUpperCase() + s.type.slice(1),
    })),
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Channels</h1>

      {/* Overview Cards */}
      <div className="flex gap-4">
        {stats.filter(s => s.total > 0).map(s => (
          <div key={s.type} className="rounded-lg border px-5 py-4 min-w-[140px]">
            <p className="text-xs text-muted-foreground capitalize">{s.type}</p>
            <p className="text-2xl font-bold mt-1">
              <span className="text-green-600">{s.verified}</span>
              <span className="text-muted-foreground text-base font-normal"> / {s.total}</span>
            </p>
            {s.failing > 0 && (
              <span className="text-xs text-destructive font-medium">{s.failing} 失敗</span>
            )}
          </div>
        ))}
        {stats.every(s => s.total === 0) && (
          <p className="text-sm text-muted-foreground">尚無通道</p>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10 shrink-0">狀態</span>
          <FilterChips options={statusOptions} paramName="status" basePath={basePath} currentParams={params} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10 shrink-0">類型</span>
          <FilterChips options={typeOptions} paramName="type" basePath={basePath} currentParams={params} />
        </div>
      </div>

      {/* Channel Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left px-4 py-2">用戶</th>
              <th className="text-left px-4 py-2">類型</th>
              <th className="text-left px-4 py-2">狀態</th>
              <th className="text-right px-4 py-2">
                <SortableHeader
                  label="失敗次數"
                  sortKey="failures"
                  basePath={basePath}
                  currentParams={params}
                  currentSort={sortKey}
                  currentDir={sortDir}
                />
              </th>
              <th className="text-right px-4 py-2">
                <SortableHeader
                  label="最後更新"
                  sortKey="updated"
                  basePath={basePath}
                  currentParams={params}
                  currentSort={sortKey}
                  currentDir={sortDir}
                />
              </th>
              <th className="text-right px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {channels.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground text-xs">
                  {statusFilter === 'all' && typeFilter === 'all' ? '尚無通道' : '沒有符合條件的通道'}
                </td>
              </tr>
            )}
            {channels.map(ch => {
              const user = ch.users as unknown as { display_name: string | null; email: string } | null
              // eslint-disable-next-line react-hooks/purity -- async Server Component renders once per request
              const diffMs = Date.now() - new Date(ch.updated_at).getTime()
              const diffHrs = Math.floor(diffMs / 3600000)
              const relUpdated = diffHrs < 1 ? '剛才' : diffHrs < 24 ? `${diffHrs} 小時前` : `${Math.floor(diffHrs / 24)} 天前`
              const isFailing = ch.consecutive_send_failures >= 3

              return (
                <tr key={ch.id} className={isFailing ? 'bg-destructive/5' : 'hover:bg-muted/20'}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-xs">{user?.display_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted capitalize">
                      {ch.channel_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {ch.is_verified
                      ? <span className="text-green-600">✓ verified</span>
                      : <span className="text-muted-foreground">✗ pending</span>}
                  </td>
                  <td className={`px-4 py-2 text-right text-xs font-medium ${isFailing ? 'text-destructive font-bold' : ch.consecutive_send_failures > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                    {ch.consecutive_send_failures}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground">{relUpdated}</td>
                  <td className="px-4 py-2 text-right">
                    <ChannelActions
                      channelId={ch.id}
                      failures={ch.consecutive_send_failures}
                      isVerified={ch.is_verified}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          共 {totalCount} 筆{statusFilter !== 'all' || typeFilter !== 'all' ? '（已篩選）' : ''}
        </p>
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} basePath={basePath} currentParams={params} />
    </div>
  )
}
