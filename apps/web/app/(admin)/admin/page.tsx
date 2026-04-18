import { createServiceClient } from '@/lib/supabase/server'
import { connection } from 'next/server'
import Link from 'next/link'
import { Suspense } from 'react'

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={null}>
      <AdminDashboardPageBody />
    </Suspense>
  )
}

async function AdminDashboardPageBody() {
  await connection()
  const supabase = createServiceClient()

  const [
    lastRunRes,
    todayRunsRes,
    failingChannelsRes,
    pushUsersRes,
    verifiedChannelsRes,
    problemsRes,
    contentRes,
    needsRegenRes,
    lowScoreRes,
  ] = await Promise.all([
    supabase.from('push_runs').select('ran_at, error_msg').order('ran_at', { ascending: false }).limit(1),
    supabase.from('push_runs').select('succeeded, failed').gte('ran_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
    supabase.from('notification_channels').select('id', { count: 'exact', head: true }).gte('consecutive_send_failures', 3),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('push_enabled', true),
    supabase.from('notification_channels').select('id', { count: 'exact', head: true }).eq('is_verified', true),
    supabase.from('problems').select('id', { count: 'exact', head: true }),
    supabase.from('problem_content').select('id', { count: 'exact', head: true }),
    supabase.from('problem_content').select('id', { count: 'exact', head: true }).eq('needs_regeneration', true),
    supabase.from('problem_content').select('id', { count: 'exact', head: true }).lt('avg_score', 3).not('avg_score', 'is', null),
  ])

  // Health indicators
  const lastRun = lastRunRes.data?.[0] ?? null
  // eslint-disable-next-line react-hooks/purity -- async Server Component renders once per request
  const now = Date.now()
  const isStale = lastRun
    ? now - new Date(lastRun.ran_at).getTime() > 2 * 60 * 60 * 1000
    : true
  const workerOk = lastRun && !isStale && !lastRun.error_msg

  const todayRuns = todayRunsRes.data ?? []
  const todaySucceeded = todayRuns.reduce((sum, r) => sum + (r.succeeded ?? 0), 0)
  const todayFailed = todayRuns.reduce((sum, r) => sum + (r.failed ?? 0), 0)
  const todayTotal = todaySucceeded + todayFailed
  const pushOk = todayTotal === 0 || todayFailed === 0

  const failingCount = failingChannelsRes.count ?? 0
  const channelsOk = failingCount === 0

  // Stat cards
  const pushUsers = pushUsersRes.count ?? 0
  const verifiedChannels = verifiedChannelsRes.count ?? 0
  const totalProblems = problemsRes.count ?? 0
  const totalContent = contentRes.count ?? 0
  const contentPct = totalProblems > 0 ? Math.round((totalContent / totalProblems) * 100) : 0
  const needsAttention = (needsRegenRes.count ?? 0) + (lowScoreRes.count ?? 0)

  // Relative time for worker
  const workerTime = lastRun
    ? (() => {
        const mins = Math.floor((now - new Date(lastRun.ran_at).getTime()) / 60000)
        if (mins < 1) return '剛才'
        if (mins < 60) return `${mins} 分鐘前`
        return `${Math.floor(mins / 60)} 小時前`
      })()
    : '從未執行'

  const healthIndicators = [
    {
      label: 'Worker 狀態',
      value: workerOk ? '正常' : isStale ? '超時' : '錯誤',
      detail: workerTime,
      ok: workerOk,
    },
    {
      label: '今日推送',
      value: todayTotal > 0 ? `${todaySucceeded}/${todayTotal}` : '尚無',
      detail: todayFailed > 0 ? `${todayFailed} 失敗` : '全部成功',
      ok: pushOk,
    },
    {
      label: '通道健康',
      value: channelsOk ? '全部正常' : `${failingCount} 異常`,
      detail: channelsOk ? '無失敗通道' : `${failingCount} 通道暫停中`,
      ok: channelsOk,
    },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Health Status Row */}
      <div className="grid grid-cols-3 gap-4">
        {healthIndicators.map(indicator => (
          <div
            key={indicator.label}
            className={`rounded-lg border-2 p-4 ${
              indicator.ok
                ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20'
                : 'border-destructive/50 bg-destructive/5'
            }`}
          >
            <p className="text-xs text-muted-foreground">{indicator.label}</p>
            <p className={`text-xl font-bold mt-1 ${indicator.ok ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
              {indicator.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{indicator.detail}</p>
          </div>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-5">
          <p className="text-xs text-muted-foreground">活躍用戶</p>
          <p className="text-3xl font-bold mt-1">{pushUsers}</p>
        </div>
        <div className="rounded-lg border p-5">
          <p className="text-xs text-muted-foreground">已驗證通道</p>
          <p className="text-3xl font-bold mt-1">{verifiedChannels}</p>
        </div>
        <div className="rounded-lg border p-5">
          <p className="text-xs text-muted-foreground">內容覆蓋率</p>
          <p className="text-3xl font-bold mt-1">{contentPct}%</p>
          <p className="text-xs text-muted-foreground">{totalContent}/{totalProblems}</p>
        </div>
        <div className={`rounded-lg border p-5 ${needsAttention > 0 ? 'border-destructive/50 bg-destructive/5' : ''}`}>
          <p className="text-xs text-muted-foreground">待處理</p>
          <p className={`text-3xl font-bold mt-1 ${needsAttention > 0 ? 'text-destructive' : ''}`}>
            {needsAttention}
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/push" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Push Monitor
          </Link>
          <Link href="/admin/channels" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Channels
          </Link>
          <Link href="/admin/content" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Review Content ({needsAttention})
          </Link>
        </div>
      </section>
    </div>
  )
}
