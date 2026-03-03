'use client'

import { useTransition } from 'react'
import { setLinePushAllowed } from '@/lib/actions/admin'

interface Props {
  userId: string
  allowed: boolean
}

export function LineToggle({ userId, allowed }: Props) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => setLinePushAllowed(userId, !allowed))}
      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
        allowed
          ? 'bg-[#06C755]/10 text-[#06C755] hover:bg-[#06C755]/20'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {isPending ? '...' : allowed ? 'LINE ✓' : 'LINE —'}
    </button>
  )
}
