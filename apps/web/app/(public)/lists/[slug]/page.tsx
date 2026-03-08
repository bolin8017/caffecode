import { createServiceClient, createClient } from '@/lib/supabase/server'
import { getSolvedProblemIds } from '@/lib/repositories/history.repository'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const revalidate = 3600
export const dynamicParams = true

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  Medium: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  Hard: 'bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = createServiceClient()
  const { data: list } = await supabase
    .from('curated_lists')
    .select('name, description, problem_count')
    .eq('slug', slug)
    .single()

  if (!list) return { title: '找不到清單 — CaffeCode' }

  return {
    title: `${list.name} — CaffeCode`,
    description: list.description ?? `${list.problem_count} 道精選題目`,
  }
}

export default async function ListDetailPage({ params }: PageProps) {
  const { slug } = await params
  const serviceClient = createServiceClient()

  // Fetch list metadata
  const { data: list } = await serviceClient
    .from('curated_lists')
    .select('id, name, slug, description, problem_count')
    .eq('slug', slug)
    .single()

  if (!list) notFound()

  // Fetch problems in sequence order
  const { data: listProblems } = await serviceClient
    .from('list_problems')
    .select(`
      sequence_number,
      problems (
        id, leetcode_id, title, slug, difficulty, rating
      )
    `)
    .eq('list_id', list.id)
    .order('sequence_number')

  // Check if user is authenticated and fetch their progress
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userProgress: { current_position: number; is_active: boolean } | null = null
  if (user) {
    const { data } = await supabase
      .from('user_list_progress')
      .select('current_position, is_active')
      .eq('user_id', user.id)
      .eq('list_id', list.id)
      .maybeSingle()
    userProgress = data
  }

  let solvedIds: Set<number> = new Set()
  if (user && listProblems?.length) {
    const problemIds = listProblems
      .map(lp => (lp.problems as unknown as { id: number } | null)?.id)
      .filter((id): id is number => id != null)
    solvedIds = await getSolvedProblemIds(supabase, user.id, problemIds)
  }

  const progressPct = userProgress
    ? Math.round((userProgress.current_position / list.problem_count) * 100)
    : null

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
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

        {/* Progress bar for logged-in users */}
        {userProgress && (
          <div className="mt-4 p-4 rounded-lg border bg-muted/30">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">你的進度</span>
              <span className="text-muted-foreground">
                {userProgress.current_position} / {list.problem_count} 題
                {userProgress.is_active && ' · 目前學習中'}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12">#</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">題目</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-24">難度</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-20 hidden sm:table-cell">
                Rating
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {listProblems?.map((lp, idx) => {
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
