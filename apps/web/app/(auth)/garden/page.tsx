import { createClient } from '@/lib/supabase/server'
import { getTopicProficiency, getGardenSummary } from '@/lib/repositories/garden.repository'
import { getUserBadges } from '@/lib/repositories/badge.repository'
import { redirect } from 'next/navigation'
import { CoffeeTree } from './coffee-tree'
import { GardenTracker } from './garden-tracker'
import { BadgeShowcase } from './badge-showcase'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '咖啡莊園 — CaffeCode' }

export default async function GardenPage() {
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
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-sm">你的莊園還沒有任何植物</p>
          <p className="text-xs mt-1">標記解出來的題目，咖啡樹就會開始生長</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {topics.map((t) => (
            <CoffeeTree
              key={t.topic}
              topic={t.topic}
              stage={t.stage}
              level={t.level}
              solvedCount={t.solvedCount}
              totalReceived={t.totalReceived}
              progressInStage={t.progressInStage}
            />
          ))}
        </div>
      )}

      {/* Growth guide */}
      <div className="rounded-xl border bg-muted/30 p-5">
        <h2 className="text-sm font-semibold mb-3">Growth Stages</h2>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { emoji: '\u{1F331}', label: 'Seed', range: '0' },
            { emoji: '\u{1F33F}', label: 'Sprout', range: '1-2' },
            { emoji: '\u{1F333}', label: 'Small', range: '3-5' },
            { emoji: '\u{1F332}', label: 'Big', range: '6-10' },
            { emoji: '\u2615', label: 'Harvest', range: '11+' },
          ].map((s) => (
            <div key={s.label} className="space-y-1">
              <p className="text-2xl">{s.emoji}</p>
              <p className="text-[10px] font-medium">{s.label}</p>
              <p className="text-[10px] text-muted-foreground">{s.range}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          After harvest, every 5 solves = +1 Level (uncapped)
        </p>
      </div>
    </main>
  )
}
