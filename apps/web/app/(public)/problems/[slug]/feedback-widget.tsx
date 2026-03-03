'use client'

import { useState, useTransition } from 'react'
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

  const handleScore = (s: number) => {
    setScore(s)
    startTransition(() => submitFeedback(problemId, undefined, s))
  }

  const handleDifficulty = (d: Difficulty) => {
    setDifficulty(d)
    startTransition(() => submitFeedback(problemId, d))
  }

  const displayScore = hovered ?? score

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <p className="text-sm font-medium text-muted-foreground">這篇解說對你有幫助嗎？</p>

      {/* Star rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            disabled={isPending}
            onClick={() => handleScore(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(undefined)}
            className="text-2xl transition-transform hover:scale-110 disabled:opacity-50"
            aria-label={`${s} 星`}
          >
            {displayScore !== undefined && s <= displayScore ? '★' : '☆'}
          </button>
        ))}
        {score !== undefined && (
          <span className="ml-2 text-xs text-muted-foreground">已評 {score} 星</span>
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
            className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
              difficulty === d
                ? 'border-primary bg-primary/5 text-primary'
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
