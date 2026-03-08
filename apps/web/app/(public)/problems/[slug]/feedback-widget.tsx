'use client'

import { useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { submitFeedback } from '@/lib/actions/feedback'

type Difficulty = 'too_easy' | 'just_right' | 'too_hard'

interface Props {
  problemId: number
  initialScore?: number
  initialDifficulty?: Difficulty
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  too_easy: '太簡單',
  just_right: '剛好',
  too_hard: '太難',
}

export function FeedbackWidget({ problemId, initialScore, initialDifficulty }: Props) {
  const [score, setScore] = useState<number | undefined>(initialScore)
  const [hovered, setHovered] = useState<number | undefined>()
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(initialDifficulty)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const flashSaved = useCallback(() => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [])

  const handleScore = (s: number) => {
    if (s === score) return
    const isFirst = score === undefined
    setScore(s)
    startTransition(async () => {
      await submitFeedback(problemId, undefined, s)
      flashSaved()
      if (isFirst) toast.success('感謝你的評分！')
    })
  }

  const handleDifficulty = (d: Difficulty) => {
    if (d === difficulty) return
    const isFirst = difficulty === undefined
    setDifficulty(d)
    startTransition(async () => {
      await submitFeedback(problemId, d)
      flashSaved()
      if (isFirst) toast.success('已記錄難度感受')
    })
  }

  const displayScore = hovered ?? score

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">這篇解說對你有幫助嗎？</p>
        {saved && (
          <span className="text-xs text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-right-1 duration-200">
            ✓ 已儲存
          </span>
        )}
      </div>

      {/* Star rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => {
          const filled = displayScore !== undefined && s <= displayScore
          return (
            <button
              key={s}
              disabled={isPending}
              onClick={() => handleScore(s)}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(undefined)}
              className={`text-2xl transition-all hover:scale-110 disabled:opacity-50 ${
                filled
                  ? 'text-yellow-500 drop-shadow-[0_0_2px_rgba(234,179,8,0.3)]'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
              aria-label={`${s} 星`}
            >
              {filled ? '★' : '☆'}
            </button>
          )
        })}
        {score !== undefined && (
          <span className="ml-2 text-xs text-muted-foreground animate-in fade-in duration-300">
            已評 {score} 星
          </span>
        )}
      </div>

      {/* Difficulty */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">難度感受：</span>
        {(['too_easy', 'just_right', 'too_hard'] as Difficulty[]).map((d) => (
          <button
            key={d}
            disabled={isPending}
            onClick={() => handleDifficulty(d)}
            className={`rounded-full border px-3 py-1 text-xs transition-all disabled:opacity-50 ${
              difficulty === d
                ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm'
                : 'hover:bg-muted'
            }`}
          >
            {DIFFICULTY_LABELS[d]}
          </button>
        ))}
      </div>
    </div>
  )
}
