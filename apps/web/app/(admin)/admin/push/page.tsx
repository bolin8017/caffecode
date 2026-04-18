import { createServiceClient } from '@/lib/supabase/server'
import { ForceNotifyButton } from './force-notify-button'

function getLastNUtcDates(n: number): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function toUtcDate(utcTimestamp: string): string {
  return new Date(utcTimestamp).toISOString().slice(0, 10)
}

export default async function AdminPushPage() {
  const supabase = createServiceClient()
  // eslint-disable-next-line react-hooks/purity -- async Server Component renders once per request
  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [runsRes, usersRes] = await Promise.all([
    supabase
      .from('push_runs')
      .select('id, ran_at, candidates, succeeded, failed, duration_ms, error_msg')
      .order('ran_at', { ascending: false })
      .limit(10),
    supabase.from('users').select('id, display_name, email, timezone, push_hour, push_hour_utc').eq('push_enabled', true),
  ])

  const runs = runsRes.data ?? []
  const pushUsers = usersRes.data ?? []

  const userIds = pushUsers.map(u => u.id)
  const { data: historyRows } = userIds.length > 0
    ? await supabase.from('history').select('user_id, sent_at').in('user_id', userIds).gte('sent_at', sevenDaysAgo)
    : { data: [] }

  const deliverySet = new Set<string>()
  for (const row of historyRows ?? []) {
    deliverySet.add(`${row.user_id}|${toUtcDate(row.sent_at)}`)
  }

  const columnDates = getLastNUtcDates(7)
  const currentUtcHour = new Date().getUTCHours()

  // Precompute the 7 UTC date strings once — avoids creating 7 Date objects per user
  const last7UtcDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })

  const usersWithGaps = pushUsers.map(user => {
    let consecutiveGap = 0
    for (const utcDate of last7UtcDates) {
      if (!deliverySet.has(`${user.id}|${utcDate}`)) consecutiveGap++
      else consecutiveGap = 0
    }
    return { ...user, consecutiveGap }
  }).sort((a, b) => b.consecutiveGap - a.consecutiveGap)

  const lastRun = runs[0] ?? null
  const isStale = lastRun ? (now - new Date(lastRun.ran_at).getTime()) > 2 * 60 * 60 * 1000 : true

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Push Monitor</h1>
        <ForceNotifyButton />
      </div>

      {/* ── Section 1: Worker Run History ── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Worker 執行紀錄
        </h2>

        {isStale && (
          <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-3 text-sm text-orange-700 dark:text-orange-400 mb-4">
            ⚠ {lastRun ? '已超過 2 小時未執行' : '尚無執行記錄，請確認 worker 是否已部署'}
          </div>
        )}

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-2">時間</th>
                <th className="text-right px-4 py-2">Candidates</th>
                <th className="text-right px-4 py-2">成功</th>
                <th className="text-right px-4 py-2">失敗</th>
                <th className="text-right px-4 py-2">耗時</th>
                <th className="text-left px-4 py-2">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    尚無執行記錄
                  </td>
                </tr>
              )}
              {runs.map((run, i) => {
                const hasError = !!run.error_msg || (run.failed ?? 0) > 0
                return (
                  <tr key={i} className={hasError ? 'bg-destructive/5' : 'hover:bg-muted/20'}>
                    <td className="px-4 py-2 text-xs">
                      {new Date(run.ran_at).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">{run.candidates}</td>
                    <td className="px-4 py-2 text-right text-xs text-green-600 font-medium">{run.succeeded}</td>
                    <td className={`px-4 py-2 text-right text-xs font-medium ${(run.failed ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {run.failed ?? 0}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {run.error_msg ? (
                        <span className="text-destructive truncate block max-w-[200px]" title={run.error_msg}>
                          ✗ {run.error_msg}
                        </span>
                      ) : (
                        <span className="text-green-600">✓</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 2: User Delivery Status ── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          用戶交付狀態 — 最近 7 天
        </h2>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs sm:text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-2">用戶</th>
                <th className="text-left px-3 py-2">排程時間</th>
                <th className="text-left px-3 py-2">狀態</th>
                {columnDates.map(date => (
                  <th key={date} className="text-center px-2 py-2 min-w-[42px]">
                    {date.slice(5).replace('-', '/')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {usersWithGaps.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    沒有啟用通知的用戶
                  </td>
                </tr>
              )}
              {usersWithGaps.map(user => {
                const warn = user.consecutiveGap >= 3
                const isScheduledNow = user.push_hour_utc === currentUtcHour
                const tz = user.timezone ?? 'Asia/Taipei'
                // Short timezone label: "Asia/Taipei" → "Taipei", "America/New_York" → "New York"
                const tzShort = tz.split('/').pop()?.replace('_', ' ') ?? tz
                return (
                  <tr key={user.id} className={warn ? 'bg-orange-50 dark:bg-orange-950/20' : 'hover:bg-muted/20'}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-xs">{user.display_name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-xs font-mono">
                        {String(user.push_hour).padStart(2, '0')}:00 {tzShort}
                      </p>
                      {isScheduledNow && (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">排程中</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {warn ? (
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          ⚠ {user.consecutiveGap} 天未收到
                        </span>
                      ) : (
                        <span className="text-green-600">正常</span>
                      )}
                    </td>
                    {columnDates.map(date => {
                      const delivered = deliverySet.has(`${user.id}|${date}`)
                      return (
                        <td key={date} className="text-center px-2 py-2">
                          {delivered
                            ? <span className="text-green-600 font-bold">✓</span>
                            : <span className="text-muted-foreground/30">·</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
