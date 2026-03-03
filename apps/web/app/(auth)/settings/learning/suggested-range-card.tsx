'use client'

import { useState } from 'react'

interface Props {
  min: number
  max: number
  feedbackCount: number
  onApply: (min: number, max: number) => void
}

export function SuggestedRangeCard({ min, max, feedbackCount, onApply }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`range-suggestion-dismissed-${min}-${max}`) === '1'
  })

  if (dismissed) return null

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
      <p className="text-sm font-medium">根據你的 {feedbackCount} 筆評分</p>
      <p className="text-xl font-bold tabular-nums">{min} – {max}</p>
      <p className="text-xs text-muted-foreground">你的「剛好」題目集中在這個區間</p>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onApply(min, max)}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          套用建議
        </button>
        <button
          onClick={() => {
            localStorage.setItem(`range-suggestion-dismissed-${min}-${max}`, '1')
            setDismissed(true)
          }}
          className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
        >
          略過
        </button>
      </div>
    </div>
  )
}
