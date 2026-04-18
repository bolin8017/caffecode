import { createClient } from '@/lib/supabase/server'
import { getTopicProficiency, getGardenSummary } from '@/lib/repositories/garden.repository'
import { getUserBadges } from '@/lib/repositories/badge.repository'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { CoffeeTree } from './coffee-tree'
import { GardenTracker } from './garden-tracker'
import { BadgeShowcase } from './badge-showcase'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '咖啡莊園 — CaffeCode' }

export default function GardenPage() {
  return (
    <Suspense fallback={null}>
      <GardenPageBody />
    </Suspense>
  )
}

async function GardenPageBody() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [topics, summary, badges] = await Promise.all([
    getTopicProficiency(supabase, user.id),
    getGardenSummary(supabase, user.id),
    getUserBadges(supabase, user.id),
  ])

  const { totalSolved, totalReceived } = summary
  const solveRate = totalReceived > 0
    ? Math.round((totalSolved / totalReceived) * 100)
    : 0

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <GardenTracker topicCount={topics.length} maxSolvedTopic={topics[0]?.topic ?? null} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">咖啡莊園</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          每道解出來的題目，都在為你的莊園澆水
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{topics.length}</p>
          <p className="text-xs text-muted-foreground mt-1">咖啡品種</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{totalSolved}</p>
          <p className="text-xs text-muted-foreground mt-1">已解題目</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{solveRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">解題率</p>
        </div>
      </div>

      <BadgeShowcase badges={badges} />

      {/* Garden grid */}
      {topics.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground space-y-4">
          <p className="text-4xl">🌱</p>
          <div>
            <p className="text-sm font-medium text-foreground">你的莊園正在等待第一顆種子</p>
            <p className="text-xs mt-1">每道解出來的題目，都會讓對應主題的咖啡樹成長</p>
          </div>
          {/* Growth path preview */}
          <div className="flex justify-center items-center gap-2 text-2xl py-1">
            <span>🌱</span>
            <span className="text-base text-muted-foreground/60">→</span>
            <span>🌿</span>
            <span className="text-base text-muted-foreground/60">→</span>
            <span>🌳</span>
            <span className="text-base text-muted-foreground/60">→</span>
            <span>🌲</span>
            <span className="text-base text-muted-foreground/60">→</span>
            <span>☕</span>
          </div>
          {/* CTAs */}
          <div className="flex justify-center gap-3 pt-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              去解今天的題目
            </Link>
            <Link
              href="/problems"
              className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              瀏覽題庫
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {topics.map((t) => (
            <CoffeeTree
              key={t.topic}
              topic={t.topic}
              stage={t.stage}
              solvedCount={t.solvedCount}
              totalReceived={t.totalReceived}
              level={t.level}
            />
          ))}
        </div>
      )}

      {/* Growth guide */}
      <div className="rounded-xl border bg-muted/30 p-5">
        <h2 className="text-sm font-semibold mb-3">成長階段</h2>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { emoji: '🌱', label: 'Lv. 0', range: '0 題' },
            { emoji: '🌿', label: 'Lv. 1', range: '1-2 題' },
            { emoji: '🌳', label: 'Lv. 2', range: '3-5 題' },
            { emoji: '🌲', label: 'Lv. 3', range: '6-10 題' },
            { emoji: '☕', label: 'Lv. 4+', range: '11+ 題' },
          ].map((s) => (
            <div key={s.label} className="space-y-1">
              <p className="text-2xl">{s.emoji}</p>
              <p className="text-[10px] font-medium">{s.label}</p>
              <p className="text-[10px] text-muted-foreground">{s.range}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          Lv. 4 之後每解 5 題升一級，等級無上限
        </p>
      </div>
    </main>
  )
}
