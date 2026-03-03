import Link from 'next/link'
import { buildFilterUrl } from '@/lib/utils/filter-url'

interface PaginationProps {
  currentPage: number
  totalPages: number
  basePath: string
  currentParams: Record<string, string | undefined>
}

export function Pagination({ currentPage, totalPages, basePath, currentParams }: PaginationProps) {
  if (totalPages <= 1) return null

  // Window-style page numbers: 1 ... 4 5 6 ... 20
  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  function pageUrl(page: number) {
    return buildFilterUrl(basePath, currentParams, { page: String(page) })
  }

  return (
    <div className="mt-6 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        第 {currentPage} 頁，共 {totalPages} 頁
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={pageUrl(currentPage - 1)}
          aria-disabled={currentPage === 1}
          className={`h-8 px-3 rounded-md border flex items-center transition-colors ${
            currentPage === 1
              ? 'pointer-events-none text-muted-foreground border-border/50'
              : 'hover:bg-muted'
          }`}
        >
          ←
        </Link>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="h-8 px-2 flex items-center text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={pageUrl(p)}
              className={`h-8 w-8 rounded-md border flex items-center justify-center transition-colors ${
                p === currentPage
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted'
              }`}
            >
              {p}
            </Link>
          ),
        )}
        <Link
          href={pageUrl(currentPage + 1)}
          aria-disabled={currentPage === totalPages}
          className={`h-8 px-3 rounded-md border flex items-center transition-colors ${
            currentPage === totalPages
              ? 'pointer-events-none text-muted-foreground border-border/50'
              : 'hover:bg-muted'
          }`}
        >
          →
        </Link>
      </div>
    </div>
  )
}
