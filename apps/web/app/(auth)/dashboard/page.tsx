import { createClient } from '@/lib/supabase/server'
import { getUserDashboard } from '@/lib/repositories/user.repository'
import { getActiveListProgress } from '@/lib/repositories/list.repository'
import { getRecentHistory, getStreakHistory } from '@/lib/repositories/history.repository'
import { calculateStreak } from '@/lib/services/streak.service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '主頁 — CaffeCode' }


const DIFFICULTY_STYLE: Record<string, { text: string; bg: string; label: string }> = {
  Easy:   { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/60', label: '簡單' },
  Medium: { text: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/60',   label: '中等' },
  Hard:   { text: 'text-rose-700 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-950/60',     label: '困難' },
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg viewBox="0 0 80 80" className="w-[72px] h-[72px] -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" className="stroke-muted" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          className="stroke-primary"
          strokeWidth="7"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums rotate-90 translate-x-[-0.5px]">
        {pct}%
      </span>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, activeProgress, recentHistory, streakHistory] =
    await Promise.all([
      getUserDashboard(supabase, user.id),
      getActiveListProgress(supabase, user.id),
      getRecentHistory(supabase, user.id, 7),
      getStreakHistory(supabase, user.id, 60),
    ])

  const streak = calculateStreak(streakHistory, profile?.timezone ?? 'Asia/Taipei')
  const totalDone = streakHistory.length

  const activeList = activeProgress?.curated_lists ?? null

  const progressPct = activeList && activeProgress
    ? Math.round((activeProgress.current_position / activeList.problem_count) * 100)
    : 0

  const displayName = profile?.display_name || user.email?.split('@')[0] || '同學'
  const isFilterMode = profile?.active_mode === 'filter'

  // Clamp filter range to slider bounds (DB defaults 0/3000 → show as 1000/2600)
  const diffMin = profile?.difficulty_min === 0 ? 1000 : (profile?.difficulty_min ?? 1000)
  const diffMax = profile?.difficulty_max === 3000 ? 2600 : (profile?.difficulty_max ?? 2600)

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
              isFilterMode
                ? 'border-violet-200 text-violet-600 bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:bg-violet-950/50'
                : 'border-sky-200 text-sky-600 bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:bg-sky-950/50'
            }`}>
              {isFilterMode ? '🔍 篩選模式' : '📋 清單模式'}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {displayName}，你好 ☕
          </h1>
        </div>
        <Link
          href="/settings/learning"
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground border rounded-full px-3 py-1.5 transition-colors mt-1"
        >
          切換模式
        </Link>
      </div>

      {/* ── Stats row ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Streak */}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            連續天數
          </p>
          <div className="flex items-end gap-1.5">
            <span className="text-4xl font-bold tabular-nums leading-none">{streak}</span>
            <span className="text-muted-foreground text-sm mb-0.5">天</span>
            {streak > 0 && <span className="text-xl mb-0.5 leading-none">🔥</span>}
          </div>
        </div>

        {/* Completed */}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            近期完成
          </p>
          <div className="flex items-end gap-1.5">
            <span className="text-4xl font-bold tabular-nums leading-none">{totalDone}</span>
            <span className="text-muted-foreground text-sm mb-0.5">題 / 60天</span>
          </div>
        </div>

        {/* Push */}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            每日通知
          </p>
          <div className="flex items-end gap-1.5 mb-1.5">
            <span className="text-4xl font-bold tabular-nums leading-none">
              {profile?.push_enabled ? `${String(profile.push_hour).padStart(2, '0')}` : '—'}
            </span>
            {profile?.push_enabled && (
              <span className="text-muted-foreground text-sm mb-0.5">:00</span>
            )}
          </div>
          <Link href="/settings" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            {profile?.push_enabled ? '變更設定 →' : '開啟通知 →'}
          </Link>
        </div>
      </div>

      {/* ── Mode hero ── */}
      {isFilterMode ? (
        /* Filter mode: rating range display */
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">評分篩選範圍</h2>
            <Link href="/settings/learning" className="text-xs text-primary hover:underline">
              調整 →
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 py-2">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">最低</p>
              <p className="text-5xl font-bold tabular-nums tracking-tight">{diffMin}</p>
            </div>
            <div className="flex flex-col items-center gap-1 pb-1">
              <div className="w-8 border-t border-dashed border-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">分</span>
              <div className="w-8 border-t border-dashed border-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">最高</p>
              <p className="text-5xl font-bold tabular-nums tracking-tight">{diffMax}</p>
            </div>
          </div>
        </div>
      ) : activeList && activeProgress ? (
        /* List mode: progress ring */
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-6">
            <ProgressRing pct={progressPct} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h2 className="font-semibold text-sm text-muted-foreground">目前學習清單</h2>
                <Link
                  href={`/lists/${activeList.slug}`}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  查看清單 →
                </Link>
              </div>
              <p className="text-xl font-bold leading-snug mb-1.5 truncate">{activeList.name}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {activeProgress.current_position} / {activeList.problem_count} 題
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <p className="mb-3 text-sm">尚未設定學習清單</p>
          <Link href="/settings/learning" className="text-sm text-primary hover:underline">
            前往設定 →
          </Link>
        </div>
      )}

      {/* ── Recent history ── */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-4">最近完成的題目</h2>
        {recentHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">還沒有刷題記錄</p>
        ) : (
          <ul className="divide-y">
            {recentHistory.map((entry, i) => {
              const p = entry.problems
              if (!p) return null
              const style = DIFFICULTY_STYLE[p.difficulty]
              return (
                <li key={i} className="flex items-center justify-between py-3 gap-4 text-sm">
                  <Link
                    href={`/problems/${p.slug}`}
                    className="font-medium hover:text-primary transition-colors truncate"
                  >
                    {p.title}
                  </Link>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {style && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${style.text} ${style.bg}`}>
                        {style.label}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(entry.sent_at).toLocaleDateString('zh-TW', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
