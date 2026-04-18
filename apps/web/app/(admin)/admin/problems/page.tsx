import { createServiceClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { DeleteProblemButton } from './delete-button'
import { PAGE_SIZE } from '@/lib/utils/filter-url'
import { sanitizeSearch } from '@/lib/utils/sanitize-search'
import { SearchInput, Pagination } from '@/components/data-table'

interface SearchParams {
  [key: string]: string | undefined
  q?: string
  page?: string
}

export default function AdminProblemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  return (
    <Suspense fallback={null}>
      <AdminProblemsPageBody searchParams={searchParams} />
    </Suspense>
  )
}

async function AdminProblemsPageBody({
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
    .select('id, leetcode_id, title, slug, difficulty, rating, topics, problem_content(id)', { count: 'exact' })
    .order('leetcode_id')
    .range(offset, offset + PAGE_SIZE - 1)

  if (params.q) {
    const q = sanitizeSearch(params.q)
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
  }

  const { data: problems, count } = await query
  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Problems</h1>
        <span className="text-sm text-muted-foreground">{totalCount} total</span>
      </div>

      <div className="mb-4">
        <SearchInput basePath="/admin/problems" currentParams={params} placeholder="搜尋題目..." />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left px-4 py-2">#</th>
              <th className="text-left px-4 py-2">Title</th>
              <th className="text-left px-4 py-2">Difficulty</th>
              <th className="text-left px-4 py-2">Rating</th>
              <th className="text-left px-4 py-2">Content</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(problems ?? []).map((p) => {
              const hasContent = Array.isArray(p.problem_content)
                ? p.problem_content.length > 0
                : !!p.problem_content
              return (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2 text-muted-foreground">{p.leetcode_id}</td>
                  <td className="px-4 py-2">
                    <a href={`/problems/${p.slug}`} target="_blank" className="hover:underline">
                      {p.title}
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium ${
                      p.difficulty === 'Easy' ? 'text-green-600' :
                      p.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {p.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{p.rating ?? '—'}</td>
                  <td className="px-4 py-2">
                    {hasContent
                      ? <span className="text-xs text-green-600">✓</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <a href={`/admin/content?problem_id=${p.id}`} className="text-xs text-primary hover:underline mr-3">
                      Edit Content
                    </a>
                    <DeleteProblemButton id={p.id} title={p.title} />
                  </td>
                </tr>
              )
            })}
            {(problems ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                  {params.q ? '沒有符合條件的結果' : '尚無資料'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/admin/problems" currentParams={params} />
    </div>
  )
}
