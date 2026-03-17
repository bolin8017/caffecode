'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { X, ChevronDown } from 'lucide-react'
import { SolveButton } from '@/components/solve-button'
import { markSolved, skipProblem } from '@/lib/actions/history'
import { trackSolveMarked } from '@/lib/analytics'
import { SolveFeedback } from '@/components/solve-feedback'
import type { SolveResult } from '@/lib/utils/solve-result'

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

const VISIBLE_LIMIT = 3

export function UnsolvedQueue({ items: initialItems }: { items: UnsolvedItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [, startTransition] = useTransition()

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        所有題目都完成了，太棒了！
      </p>
    )
  }

  const visibleItems = expanded ? items : items.slice(0, VISIBLE_LIMIT)
  const remainingCount = items.length - VISIBLE_LIMIT

  const handleSolve = (problemId: number, sentAt: string) => {
    setPendingId(problemId)
    let removedItem: UnsolvedItem | undefined
    setItems((prev) => {
      removedItem = prev.find((item) => item.problemId === problemId)
      return prev.filter((item) => item.problemId !== problemId)
    })
    startTransition(async () => {
      try {
        const result = await markSolved(problemId)
        setSolveResult(result)
        const timeSinceSentSec = Math.round(
          (Date.now() - new Date(sentAt).getTime()) / 1000
        )
        trackSolveMarked({ problemId, source: 'dashboard', timeSinceSentSec })
      } catch {
        if (removedItem) {
          setItems((prev) => [...prev, removedItem!].sort(
            (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
          ))
        }
        toast.error('標記失敗，請再試一次')
      } finally {
        setPendingId(null)
      }
    })
  }

  const handleSkip = (problemId: number) => {
    let removedItem: UnsolvedItem | undefined
    setItems((prev) => {
      removedItem = prev.find((item) => item.problemId === problemId)
      return prev.filter((item) => item.problemId !== problemId)
    })
    startTransition(async () => {
      try {
        await skipProblem(problemId)
      } catch {
        if (removedItem) {
          setItems((prev) => [...prev, removedItem!].sort(
            (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
          ))
        }
        toast.error('跳過失敗，請再試一次')
      }
    })
  }

  return (
    <>
    <ul className="divide-y">
      {visibleItems.map((item) => {
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
              <button
                type="button"
                onClick={() => handleSkip(item.problemId)}
                title="跳過"
                className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5 -mr-1"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
    {remainingCount > 0 && !expanded && (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 mx-auto"
      >
        <ChevronDown className="size-3.5" />
        還有 {remainingCount} 題
      </button>
    )}
    <SolveFeedback result={solveResult} onDismiss={() => setSolveResult(null)} />
    </>
  )
}
