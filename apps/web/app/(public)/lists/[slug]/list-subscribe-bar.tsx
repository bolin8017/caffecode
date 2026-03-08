'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { subscribeToList } from '@/lib/actions/settings'

interface Props {
  listId: number
  listName: string
  problemCount: number
  userProgress: {
    current_position: number
    is_active: boolean
  } | null
}

export function ListSubscribeBar({ listId, listName, problemCount, userProgress }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const handleSubscribe = (startPosition?: number) => {
    setMessage(null)
    startTransition(async () => {
      try {
        await subscribeToList(listId, startPosition)
        setMessage(startPosition !== undefined
          ? `已從第 ${startPosition + 1} 題開始學習「${listName}」`
          : '已開始學習此清單')
      } catch {
        setMessage('訂閱失敗，請重試')
      }
    })
  }

  // Currently active on this list
  if (userProgress?.is_active) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-primary">
          目前學習中 · {userProgress.current_position} / {problemCount} 題
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSubscribe(0)}
          disabled={isPending}
        >
          從頭開始
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    )
  }

  // Has previous progress (returning user)
  if (userProgress && userProgress.current_position > 0) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          size="sm"
          onClick={() => handleSubscribe()}
          disabled={isPending}
        >
          從第 {userProgress.current_position + 1} 題繼續
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSubscribe(0)}
          disabled={isPending}
        >
          從頭開始
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    )
  }

  // Never subscribed
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        size="sm"
        onClick={() => handleSubscribe()}
        disabled={isPending}
      >
        訂閱此清單
      </Button>
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  )
}

export function StartFromHereButton({
  listId,
  sequenceNumber,
}: {
  listId: number
  sequenceNumber: number
}) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      await subscribeToList(listId, sequenceNumber - 1)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
      title={`從第 ${sequenceNumber} 題開始`}
    >
      ▶
    </button>
  )
}
