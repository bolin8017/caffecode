'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { topicLabel } from '@caffecode/shared'
import { SolveCelebrationModal } from '@/components/solve-celebration-modal'
import type { SolveResult } from '@/lib/utils/solve-result'

const STAGE_EMOJI = ['🌱', '🌿', '🌳', '🌲', '☕'] as const

function stageFromCount(count: number): number {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}

interface Props {
  result: SolveResult | null
  onDismiss: () => void
}

export function SolveFeedback({ result, onDismiss }: Props) {
  const toastedRef = useRef<SolveResult | null>(null)

  const hasLevelUp = (result?.levelUps.length ?? 0) > 0
  const hasBadge = (result?.newBadges.length ?? 0) > 0
  const showModal = result !== null && (hasLevelUp || hasBadge || (result.firstSolve ?? false))

  // Toast for progress-only results (no level-up or badge)
  useEffect(() => {
    if (!result || result === toastedRef.current || hasLevelUp || hasBadge) return

    toastedRef.current = result

    if (result.topicProgress.length > 0) {
      const closest = result.topicProgress.reduce((best, t) => {
        const ratio = t.solvedCount / t.nextThreshold
        const bestRatio = best.solvedCount / best.nextThreshold
        return ratio > bestRatio ? t : best
      })
      const emoji = STAGE_EMOJI[stageFromCount(closest.solvedCount)]
      toast.success(
        `${topicLabel(closest.topic)} ${closest.solvedCount}/${closest.nextThreshold} → Lv.${closest.level} ${emoji}`,
      )
    }

    onDismiss()
  }, [result, hasLevelUp, hasBadge, onDismiss])

  if (!showModal || !result) return null

  return (
    <SolveCelebrationModal
      levelUps={result.levelUps}
      newBadges={result.newBadges}
      firstSolve={result.firstSolve}
      onClose={onDismiss}
    />
  )
}
