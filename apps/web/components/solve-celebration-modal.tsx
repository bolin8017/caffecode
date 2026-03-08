'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { topicLabel } from '@caffecode/shared'
import type { SolveResult } from '@/lib/utils/solve-result'

const STAGE_EMOJI = ['🌱', '🌿', '🌳', '🌲', '☕'] as const

interface Props {
  levelUps: SolveResult['levelUps']
  newBadges: SolveResult['newBadges']
  onClose: () => void
}

export function SolveCelebrationModal({ levelUps, newBadges, onClose }: Props) {
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleNavigate = (path: string) => {
    onClose()
    router.push(path)
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lg animate-in zoom-in-95 duration-200">
        {/* Level-ups */}
        {levelUps.length > 0 && (
          <div className="space-y-4">
            {levelUps.map((lu) => (
              <div key={lu.topic} className="text-center space-y-2">
                <div className="text-4xl">
                  {STAGE_EMOJI[lu.newStage - 1] ?? '🌱'} → {STAGE_EMOJI[lu.newStage]}
                </div>
                <p className="text-lg font-semibold">{topicLabel(lu.topic)} 升級！</p>
                <p className="text-sm text-muted-foreground">
                  Lv.{lu.oldLevel} → Lv.{lu.newLevel}・{lu.variety}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Separator if both */}
        {levelUps.length > 0 && newBadges.length > 0 && (
          <hr className="my-4 border-border" />
        )}

        {/* Badges */}
        {newBadges.length > 0 && (
          <div className="space-y-3">
            {newBadges.map((badge) => (
              <div key={badge.name} className="text-center space-y-1">
                <div className="text-4xl">{badge.icon}</div>
                <p className="text-sm font-medium text-muted-foreground">獲得新徽章！</p>
                <p className="text-lg font-semibold">「{badge.name}」</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigate('/garden')}
          >
            {newBadges.length > 0 && levelUps.length === 0 ? '查看徽章' : '查看咖啡園'}
          </Button>
          <Button size="sm" onClick={onClose}>
            繼續
          </Button>
        </div>
      </div>
    </div>
  )
}
