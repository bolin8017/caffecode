import { createServiceClient, createClient } from '@/lib/supabase/server'
import { getSolvedProblemIds } from '@/lib/repositories/history.repository'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ListSubscribeBar, StartFromHereButton } from './list-subscribe-bar'

import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbSchema, itemListSchema } from '@/lib/seo/schemas'

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  Medium: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  Hard: 'bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
}

async function getListBySlug(slug: string) {
  'use cache'
  cacheLife('hours')
  cacheTag('lists', `list:${slug}`)
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('curated_lists')
    .select('id, name, slug, description, problem_count')
    .eq('slug', slug)
    .single()
  return data
}

async function getListProblems(listId: number) {
  'use cache'
  cacheLife('hours')
  cacheTag('lists', 'problems', `list:${listId}:problems`)
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('list_problems')
    .select(`
      sequence_number,
      problems (
        id, leetcode_id, title, slug, difficulty, rating
      )
    `)
    .eq('list_id', listId)
    .order('sequence_number')
  return data ?? []
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const list = await getListBySlug(slug)

  if (!list) return { title: '找不到清單' }

  return {
    title: list.name,
    description: list.description ?? `${list.name} — 包含 ${list.problem_count} 道題目的精選刷題清單。`,
    alternates: { canonical: `/lists/${slug}` },
  }
}

export default function ListDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <ListDetailPageBody params={params} />
    </Suspense>
  )
}

async function ListDetailPageBody({ params }: PageProps) {
  const { slug } = await params
  const list = await getListBySlug(slug)

  if (!list) notFound()

  const listProblems = await getListProblems(list.id)

  // Check if user is authenticated and fetch their progress
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userProgress: { current_position: number; is_active: boolean } | null = null
  let solvedIds: Set<number> = new Set()
  if (user) {
    const problemIds = listProblems
      .map(lp => (lp.problems as unknown as { id: number } | null)?.id)
      .filter((id): id is number => id != null)

    const [progressResult, solvedResult] = await Promise.all([
      supabase
        .from('user_list_progress')
        .select('current_position, is_active')
        .eq('user_id', user.id)
        .eq('list_id', list.id)
        .maybeSingle(),
      problemIds.length > 0
        ? getSolvedProblemIds(supabase, user.id, problemIds)
        : Promise.resolve(new Set<number>()),
    ])
    userProgress = progressResult.data
    solvedIds = solvedResult
  }

  const progressPct = userProgress
    ? Math.round((userProgress.current_position / list.problem_count) * 100)
    : null

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <JsonLd data={itemListSchema(
        list.name,
        listProblems
          .map(lp => lp.problems as unknown as { title: string; slug: string } | null)
          .filter((p): p is { title: string; slug: string } => p != null)
      )} />
      <JsonLd data={breadcrumbSchema([
        { name: '首頁', url: 'https://caffecode.net' },
        { name: '學習清單', url: 'https://caffecode.net/lists' },
        { name: list.name, url: `https://caffecode.net/lists/${list.slug}` },
      ])} />
      {/* Header */}
      <div className="mb-8">
        <Link href="/lists" className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">
          ← 所有清單
        </Link>
        <h1 className="text-3xl font-bold">{list.name}</h1>
        {list.description && (
          <p className="mt-2 text-muted-foreground">{list.description}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">{list.problem_count} 道題目</p>

        {/* Subscribe bar + Progress for logged-in users */}
        {user && (
          <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-3">
            <ListSubscribeBar
              listId={list.id}
              listName={list.name}
              problemCount={list.problem_count}
              userProgress={userProgress}
            />
            {userProgress && (
              <div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Problem table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {user && (
                <th className="px-2 py-3 w-8" />
              )}
              {user && <th className="px-1 py-3 w-8" />}
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12">#</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">題目</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-24">難度</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-20 hidden sm:table-cell">
                Rating
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {listProblems.map((lp, idx) => {
              const p = lp.problems as unknown as {
                id: number; leetcode_id: number; title: string
                slug: string; difficulty: string; rating: number | null
              } | null
              if (!p) return null
              const isCurrent = userProgress && idx === userProgress.current_position
              return (
                <tr
                  key={lp.sequence_number}
                  className={`hover:bg-muted/30 transition-colors ${isCurrent ? 'bg-primary/5' : ''}`}
                >
                  {user && (
                    <td className="px-2 py-3 text-center">
                      {solvedIds.has(p.id) && (
                        <span className="text-emerald-500" title="已解題">✓</span>
                      )}
                    </td>
                  )}
                  {user && (
                    <td className="px-1 py-3 text-center">
                      <StartFromHereButton listId={list.id} sequenceNumber={lp.sequence_number} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground">{lp.sequence_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isCurrent && (
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                      <Link
                        href={`/problems/${p.slug}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {p.leetcode_id}. {p.title}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[p.difficulty] ?? ''}`}>
                      {p.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {p.rating ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}
