'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { SolveButton } from '@/components/solve-button'
import { markSolved } from '@/lib/actions/history'
import { trackSolveMarked } from '@/lib/analytics'

interface UnsolvedItem {
  problemId: number
  title: string
  slug: string
  difficulty: string
  sentAt: string
}

const DIFFICULTY_STYLE: Record<string, { text: string; bg: string; label: string }> = {
  Easy:   { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/60', label: '簡單' },
  Medium: { text: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/60',   label: '中等' },
  Hard:   { text: 'text-rose-700 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-950/60',     label: '困難' },
}

export function UnsolvedQueue({ items: initialItems }: { items: UnsolvedItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        所有題目都完成了，太棒了！
      </p>
    )
  }

  const handleSolve = (problemId: number, sentAt: string) => {
    setPendingId(problemId)
    startTransition(async () => {
      try {
        await markSolved(problemId)
        setItems((prev) => prev.filter((item) => item.problemId !== problemId))
        const timeSinceSentSec = Math.round(
          (Date.now() - new Date(sentAt).getTime()) / 1000
        )
        trackSolveMarked({ problemId, source: 'dashboard', timeSinceSentSec })
      } catch {
        // Keep item in list on failure
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <ul className="divide-y">
      {items.map((item) => {
        const style = DIFFICULTY_STYLE[item.difficulty]
        return (
          <li key={item.problemId} className="flex items-center justify-between py-3 gap-4 text-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <SolveButton
                problemId={item.problemId}
                solvedAt={null}
                onSolve={() => handleSolve(item.problemId, item.sentAt)}
                isPending={pendingId === item.problemId}
                variant="compact"
              />
              <Link
                href={`/problems/${item.slug}`}
                className="font-medium hover:text-primary transition-colors truncate"
              >
                {item.title}
              </Link>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {style && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${style.text} ${style.bg}`}>
                  {style.label}
                </span>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {new Date(item.sentAt).toLocaleDateString('zh-TW', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
