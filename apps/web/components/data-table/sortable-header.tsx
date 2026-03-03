import Link from 'next/link'
import { buildFilterUrl } from '@/lib/utils/filter-url'

interface SortableHeaderProps {
  label: string
  sortKey: string
  basePath: string
  currentParams: Record<string, string | undefined>
  currentSort?: string
  currentDir?: 'asc' | 'desc'
  defaultDir?: 'asc' | 'desc'
  className?: string
}

export function SortableHeader({
  label,
  sortKey,
  basePath,
  currentParams,
  currentSort,
  currentDir = 'desc',
  defaultDir = 'desc',
  className,
}: SortableHeaderProps) {
  const isActive = currentSort === sortKey
  const nextDir = isActive && currentDir === defaultDir
    ? (defaultDir === 'desc' ? 'asc' : 'desc')
    : defaultDir

  const href = buildFilterUrl(basePath, currentParams, {
    sort: sortKey,
    dir: nextDir,
  })

  const indicator = isActive ? (currentDir === 'desc' ? ' ↓' : ' ↑') : ''

  return (
    <Link href={href} className={`hover:text-foreground ${className ?? ''}`}>
      {label}{indicator}
    </Link>
  )
}
