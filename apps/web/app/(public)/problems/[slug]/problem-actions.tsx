'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SolveButton } from '@/components/solve-button'
import { markSolved } from '@/lib/actions/history'
import { trackSolveMarked } from '@/lib/analytics'
import { cn } from '@/lib/utils'

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  Medium: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  Hard: 'bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
}

interface Props {
  problemId: number
  initialSolvedAt: string | null
  sentAt: string | null
  slug: string
  leetcodeId: number
  title: string
  difficulty: string
}

export function ProblemActions({
  problemId,
  initialSolvedAt,
  sentAt,
  slug,
  leetcodeId,
  title,
  difficulty,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [showSticky, setShowSticky] = useState(false)
  const [solvedAt, setSolvedAt] = useState(initialSolvedAt)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleSolve = () => {
    setError(null)
    startTransition(async () => {
      try {
        await markSolved(problemId)
        setSolvedAt(new Date().toISOString())
        const timeSinceSentSec = sentAt
          ? Math.round((Date.now() - new Date(sentAt).getTime()) / 1000)
          : null
        trackSolveMarked({ problemId, source: 'problem', timeSinceSentSec })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed, please try again')
      }
    })
  }

  return (
    <>
      {/* Header action bar — sentinel for IntersectionObserver */}
      <div ref={sentinelRef} className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link
            href={`https://leetcode.com/problems/${slug}/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            在 LeetCode 上作答 ↗
          </Link>
        </Button>
        <SolveButton
          problemId={problemId}
          solvedAt={solvedAt}
          onSolve={handleSolve}
          isPending={isPending}
          error={error}
        />
      </div>

      {/* Sticky bottom bar */}
      <div
        className={cn(
          'fixed bottom-0 inset-x-0 z-30 border-t',
          'bg-background/80 backdrop-blur-lg pb-safe',
          'transition-all duration-200 ease-out',
          showSticky && !solvedAt
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none',
        )}
      >
        <div className="mx-auto max-w-3xl px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-muted-foreground truncate">
              {leetcodeId}. {title}
            </span>
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
                DIFFICULTY_COLORS[difficulty] ?? '',
              )}
            >
              {difficulty}
            </span>
          </div>
          <SolveButton
            problemId={problemId}
            solvedAt={solvedAt}
            onSolve={handleSolve}
            isPending={isPending}
            error={error}
            className="shrink-0"
          />
        </div>
      </div>
    </>
  )
}
