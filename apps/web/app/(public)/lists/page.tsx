import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Metadata } from 'next'
import { PAGE_SIZE } from '@/lib/utils/filter-url'
import { FilterChips, Pagination } from '@/components/data-table'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '學習清單 — CaffeCode',
  description: '33 份精選刷題清單，涵蓋演算法、資料結構與各大廠面試高頻題型',
}

const CATEGORY_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'classic', label: '經典清單' },
  { value: 'company', label: '公司清單' },
  { value: 'topic', label: '主題技巧' },
  { value: 'challenge', label: '難度挑戰' },
]

const CATEGORY_DB_TYPES: Record<string, string[]> = {
  classic: ['classic', 'official'],
  company: ['company'],
  topic: ['topic', 'algorithm'],
  challenge: ['difficulty', 'challenge'],
}

interface SearchParams {
  [key: string]: string | undefined
  category?: string
  page?: string
}

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const currentPage = Math.max(1, Number(params.page ?? '1'))
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = createServiceClient()
  let query = supabase
    .from('curated_lists')
    .select('id, slug, name, description, problem_count, type', { count: 'exact' })
    .order('id')
    .range(offset, offset + PAGE_SIZE - 1)

  const category = params.category ?? ''
  if (category && CATEGORY_DB_TYPES[category]) {
    query = query.in('type', CATEGORY_DB_TYPES[category])
  }

  const { data: lists, count } = await query
  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">學習清單</h1>
        <p className="mt-1 text-muted-foreground">共 {totalCount} 份精選清單</p>
      </div>

      <div className="mb-8">
        <FilterChips
          options={CATEGORY_OPTIONS}
          paramName="category"
          basePath="/lists"
          currentParams={params}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists?.map((list) => (
          <Link key={list.id} href={`/lists/${list.slug}`} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base group-hover:text-primary transition-colors">
                  {list.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {list.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{list.description}</p>
                )}
                <span className="text-xs text-muted-foreground">{list.problem_count} 道題目</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {totalCount === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          {params.category ? '沒有符合條件的清單' : '尚無清單'}
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/lists" currentParams={params} />
    </main>
  )
}
