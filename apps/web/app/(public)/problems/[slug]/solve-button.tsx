'use client'

import { useState, useTransition } from 'react'
import { markSolved } from '@/lib/actions/history'
import { trackSolveMarked } from '@/lib/analytics'

interface Props {
  problemId: number
  initialSolvedAt: string | null
  sentAt: string | null
  hasFeedback: boolean
}

export function SolveButton({ problemId, initialSolvedAt, sentAt, hasFeedback }: Props) {
  const [solvedAt, setSolvedAt] = useState(initialSolvedAt)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (solvedAt) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <span>✅</span>
        <span>已標記解題</span>
      </div>
    )
  }

  const handleClick = () => {
    setError(null)
    startTransition(async () => {
      try {
        await markSolved(problemId)
        setSolvedAt(new Date().toISOString())
        const timeSinceSentSec = sentAt
          ? Math.round((Date.now() - new Date(sentAt).getTime()) / 1000)
          : null
        trackSolveMarked({ problemId, source: 'web', timeSinceSentSec })
      } catch (err) {
        setError(err instanceof Error ? err.message : '標記失敗，請稍後再試')
      }
    })
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleClick}
        disabled={isPending || !hasFeedback}
        title={!hasFeedback ? '請先送出上方的題目評分' : undefined}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      >
        {isPending ? '記錄中…' : '✅ 我解出來了'}
      </button>
      {!hasFeedback && (
        <p className="text-xs text-muted-foreground">請先送出上方評分，即可標記解題</p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
