import { createServiceClient, createClient } from '@/lib/supabase/server'
import { getSolvedProblemIds } from '@/lib/repositories/history.repository'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PAGE_SIZE } from '@/lib/utils/filter-url'
import { SearchInput, FilterChips, Pagination } from '@/components/data-table'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '題庫 — CaffeCode',
  description: '瀏覽所有資料結構與演算法題目，含 AI 解題說明',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  Medium: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  Hard: 'bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
}

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Easy', label: 'Easy' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Hard', label: 'Hard' },
]

interface SearchParams {
  [key: string]: string | undefined
  q?: string
  difficulty?: string
  page?: string
}

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const currentPage = Math.max(1, Number(params.page ?? '1'))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = createServiceClient()
  let query = supabase
    .from('problems')
    .select('id, leetcode_id, title, slug, difficulty, rating, topics, problem_content!inner(id)', { count: 'exact' })
    .order('leetcode_id')

  if (params.difficulty) query = query.eq('difficulty', params.difficulty)
  if (params.q) query = query.ilike('title', `%${params.q}%`)

  const { data: problems, count } = await query.range(offset, offset + PAGE_SIZE - 1)

  // Conditionally fetch solved status for logged-in users
  let solvedIds: Set<number> = new Set()
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (user && problems?.length) {
    solvedIds = await getSolvedProblemIds(
      userClient, user.id, problems.map(p => p.id)
    )
  }

  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">題庫</h1>
        <p className="mt-1 text-muted-foreground">共 {totalCount} 道題目含解題說明</p>
      </div>

      <div className="mb-4">
        <SearchInput basePath="/problems" currentParams={params} placeholder="搜尋題目..." />
      </div>

      <div className="mb-4">
        <FilterChips
          options={DIFFICULTY_OPTIONS}
          paramName="difficulty"
          basePath="/problems"
          currentParams={params}
        />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {user && (
                <th className="px-2 py-3 w-8" />
              )}
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-16">#</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">題目</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-24">難度</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-20 hidden sm:table-cell">Rating</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Topics</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {problems?.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                {user && (
                  <td className="px-2 py-3 text-center">
                    {solvedIds.has(p.id) && (
                      <span className="text-emerald-500" title="已解題">✓</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-muted-foreground">{p.leetcode_id}</td>
                <td className="px-4 py-3">
                  <Link href={`/problems/${p.slug}`} className="font-medium hover:text-primary transition-colors">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[p.difficulty] ?? ''}`}>
                    {p.difficulty}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.rating ?? '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {p.topics.slice(0, 3).map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                    {p.topics.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{p.topics.length - 3}</Badge>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalCount === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            {params.q || params.difficulty ? '沒有符合條件的題目' : '尚無題目'}
          </div>
        )}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/problems" currentParams={params} />
    </main>
  )
}
