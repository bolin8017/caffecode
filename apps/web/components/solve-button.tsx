'use client'

import { Button } from '@/components/ui/button'
import { Check, Circle, CircleCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SolveButtonProps {
  problemId: number
  solvedAt: string | null
  onSolve: () => void
  isPending: boolean
  error?: string | null
  variant?: 'default' | 'compact'
  className?: string
}

export function SolveButton({
  solvedAt,
  onSolve,
  isPending,
  error,
  variant = 'default',
  className,
}: SolveButtonProps) {
  // ── Compact variant (Dashboard icon button) ──
  if (variant === 'compact') {
    if (solvedAt) {
      return (
        <div className={cn('p-0.5 text-emerald-500 dark:text-emerald-400', className)} title="已解題">
          <CircleCheck className="size-5" />
        </div>
      )
    }
    return (
      <button
        onClick={onSolve}
        disabled={isPending}
        className={cn(
          'group rounded-full p-0.5 transition-colors',
          'text-muted-foreground/40 hover:text-emerald-500 hover:bg-emerald-50',
          'dark:hover:text-emerald-400 dark:hover:bg-emerald-950/50',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        title="標記已解題"
      >
        {isPending
          ? <Loader2 className="size-5 animate-spin text-emerald-500" />
          : <Circle className="size-5 transition-transform group-hover:scale-110" />}
      </button>
    )
  }

  // ── Default variant (Problem page button) ──
  if (solvedAt) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400',
          className,
        )}
        role="status"
        aria-label="已標記為已解題"
      >
        <Check className="size-4" />
        <span>已標記完成</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      <Button size="sm" onClick={onSolve} disabled={isPending}>
        {isPending
          ? <><Loader2 className="size-4 animate-spin" /> 記錄中...</>
          : <><CircleCheck className="size-4" /> 我解出來了！</>}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
