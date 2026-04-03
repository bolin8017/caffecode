import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { flagForRegeneration, unflagRegeneration } from '@/lib/actions/admin'
import { PAGE_SIZE } from '@/lib/utils/filter-url'
import { FilterChips, Pagination } from '@/components/data-table'

interface SearchParams {
  [key: string]: string | undefined
  filter?: string
  problem_id?: string
  page?: string
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'flagged', label: 'Needs Regeneration' },
  { value: 'low_score', label: 'Low Score (<3★)' },
]

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const filter = params.filter ?? 'all'
  const currentPage = Math.max(1, Number(params.page ?? '1'))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = createServiceClient()

  let query = supabase
    .from('problem_content')
    .select('problem_id, avg_score, score_count, needs_regeneration, problems(title, slug, difficulty)', { count: 'exact' })
    .order('problem_id')
    .range(offset, offset + PAGE_SIZE - 1)

  if (filter === 'flagged') {
    query = query.eq('needs_regeneration', true)
  } else if (filter === 'low_score') {
    query = query.lt('avg_score', 3).not('avg_score', 'is', null)
  }

  if (params.problem_id) {
    const parsed = z.coerce.number().int().positive().safeParse(params.problem_id)
    if (parsed.success) {
      query = query.eq('problem_id', parsed.data)
    }
  }

  const { data: contents, count } = await query
  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Content</h1>
        <span className="text-sm text-muted-foreground">{totalCount} items</span>
      </div>

      <div className="mb-4">
        <FilterChips
          options={FILTER_OPTIONS}
          paramName="filter"
          basePath="/admin/content"
          currentParams={params}
          defaultValue="all"
        />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left px-4 py-2">Problem</th>
              <th className="text-left px-4 py-2">Difficulty</th>
              <th className="text-left px-4 py-2">Avg Score</th>
              <th className="text-left px-4 py-2">Ratings</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(contents ?? []).map((c) => {
              const problem = c.problems as unknown as { title: string; slug: string; difficulty: string } | null
              return (
                <tr key={c.problem_id} className="hover:bg-muted/20">
                  <td className="px-4 py-2">
                    <a href={`/problems/${problem?.slug}`} target="_blank" className="hover:underline">
                      {problem?.title ?? `Problem #${c.problem_id}`}
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium ${
                      problem?.difficulty === 'Easy' ? 'text-green-600' :
                      problem?.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {problem?.difficulty ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {c.avg_score !== null
                      ? <span className={c.avg_score < 3 ? 'text-destructive' : ''}>{c.avg_score.toFixed(1)}★</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{c.score_count}</td>
                  <td className="px-4 py-2">
                    {c.needs_regeneration ? (
                      <span className="text-xs rounded-full bg-destructive/10 text-destructive px-2 py-0.5">Flagged</span>
                    ) : (
                      <span className="text-xs text-green-600">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right space-x-3">
                    {c.needs_regeneration ? (
                      <form className="inline" action={async () => {
                        'use server'
                        await unflagRegeneration(c.problem_id)
                      }}>
                        <button type="submit" className="text-xs text-primary hover:underline">Unflag</button>
                      </form>
                    ) : (
                      <form className="inline" action={async () => {
                        'use server'
                        await flagForRegeneration(c.problem_id)
                      }}>
                        <button type="submit" className="text-xs text-muted-foreground hover:underline">Flag</button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
            {(contents ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                  {filter !== 'all' ? '沒有符合條件的結果' : '尚無內容'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/admin/content" currentParams={params} />
    </div>
  )
}
