'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { connectEmail } from '@/lib/actions/email'

export function EmailConnectButton() {
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await connectEmail()
        setConnectedEmail(result.email)
      } catch {
        setError('操作失敗，請重試')
      }
    })
  }

  if (connectedEmail) {
    return (
      <p className="text-sm text-muted-foreground">✓ 已連結 {connectedEmail}</p>
    )
  }

  return (
    <div className="text-right space-y-1">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? '連結中...' : '新增 Email'}
      </Button>
    </div>
  )
}
