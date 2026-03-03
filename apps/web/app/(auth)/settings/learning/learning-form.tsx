'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { updateLearningMode } from '@/lib/actions/settings'
import { SuggestedRangeCard } from './suggested-range-card'

interface CuratedList { id: number; name: string; slug: string; problem_count: number }

interface Props {
  mode: 'list' | 'filter'
  lists: CuratedList[]
  activeListId: number | null
  difficultyMin: number
  difficultyMax: number
  suggestedRange?: { min: number; max: number } | null
  feedbackCount?: number
}

const SLIDER_MIN = 1000
const SLIDER_MAX = 2600

export function LearningForm({ mode: initialMode, lists, activeListId: initialListId, difficultyMin, difficultyMax, suggestedRange, feedbackCount }: Props) {
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'list' | 'filter'>(initialMode)
  const [selectedList, setSelectedList] = useState(initialListId)
  const [ratingRange, setRatingRange] = useState<[number, number]>([
    Math.max(SLIDER_MIN, difficultyMin === 0 ? SLIDER_MIN : difficultyMin),
    Math.min(SLIDER_MAX, difficultyMax === 3000 ? SLIDER_MAX : difficultyMax),
  ])
  const [saved, setSaved] = useState('')

  const save = (action: () => Promise<void>, label: string) => {
    startTransition(async () => {
      await action()
      setSaved(label)
      setTimeout(() => setSaved(''), 2500)
    })
  }

  return (
    <div className="space-y-6">
      {saved && (
        <div className="rounded-md bg-green-50 dark:bg-green-950 px-4 py-2 text-sm text-green-700 dark:text-green-300">
          ✓ {saved} 已儲存
        </div>
      )}

      <div className="flex gap-3">
        {(['list', 'filter'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              mode === m
                ? 'border-primary bg-primary/5 text-primary'
                : 'hover:bg-muted'
            }`}
          >
            {m === 'list' ? '📋 清單模式' : '🔍 篩選模式'}
          </button>
        ))}
      </div>

      {mode === 'list' ? (
        <div className="flex items-center gap-3">
          <select
            value={selectedList ?? ''}
            onChange={(e) => setSelectedList(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">選擇清單...</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.problem_count} 題)
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || !selectedList}
            onClick={() =>
              selectedList &&
              save(() => updateLearningMode({ mode: 'list', list_id: selectedList }), '學習模式')
            }
          >
            儲存
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {suggestedRange && feedbackCount !== undefined && feedbackCount >= 5 && (
            <SuggestedRangeCard
              min={suggestedRange.min}
              max={suggestedRange.max}
              feedbackCount={feedbackCount}
              onApply={(min, max) => setRatingRange([min, max])}
            />
          )}
          <div>
            <div className="flex justify-between mb-3">
              <span className="text-sm text-muted-foreground">評分區間</span>
              <span className="text-sm font-medium tabular-nums">
                {ratingRange[0]} — {ratingRange[1]}
              </span>
            </div>
            <Slider
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={100}
              value={ratingRange}
              onValueChange={(v) => setRatingRange([v[0], v[1]])}
              className="w-full"
            />
            <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
              <span>{SLIDER_MIN}</span>
              <span>{SLIDER_MAX}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              save(
                () => updateLearningMode({
                  mode: 'filter',
                  difficulty_min: ratingRange[0],
                  difficulty_max: ratingRange[1],
                  topic_filter: null,
                }),
                '學習模式'
              )
            }
          >
            儲存
          </Button>
        </div>
      )}
    </div>
  )
}
