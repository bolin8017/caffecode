'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'

interface ConnectResult {
  deepLink: string
  linkToken?: string
}

interface Props {
  channelName: string
  channelColor: string   // Tailwind bg class e.g. 'bg-[#2AABEE]' or 'bg-[#06C755]'
  onConnect: () => Promise<ConnectResult>
  tokenInstruction?: string
}

export function ChannelConnectButton({ channelName, channelColor, onConnect, tokenInstruction }: Props) {
  const [result, setResult] = useState<ConnectResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    setError(null)
    startTransition(async () => {
      try {
        setResult(await onConnect())
      } catch {
        setError('操作失敗，請重試')
      }
    })
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (result) {
    return (
      <div className="space-y-2 w-full">
        <div className="flex justify-end">
          <a
            href={result.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-md ${channelColor} px-4 py-2 text-sm font-medium text-white hover:opacity-90`}
          >
            開啟 {channelName} →
          </a>
        </div>
        {result.linkToken && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {tokenInstruction ?? '在對話框貼上以下指令並發送：'}
            </p>
            <div className="flex items-center gap-2 rounded border bg-muted px-3 py-2">
              <code className="flex-1 text-xs font-mono break-all min-w-0">{result.linkToken}</code>
              <button
                onClick={() => handleCopy(result.linkToken!)}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? '✓ 已複製' : '複製'}
              </button>
            </div>
          </div>
        )}
      </div>
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
        {isPending ? '產生連結中...' : `新增 ${channelName}`}
      </Button>
    </div>
  )
}
