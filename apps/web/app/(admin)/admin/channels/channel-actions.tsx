'use client'

import { useState, useTransition } from 'react'
import { resetChannelFailures, testNotifyChannel, type TestNotifyResult } from '@/lib/actions/admin'

interface Props {
  channelId: string
  failures: number
  isVerified: boolean
}

export function ChannelActions({ channelId, failures, isVerified }: Props) {
  const [resetPending, startResetTransition] = useTransition()
  const [testState, setTestState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [testResult, setTestResult] = useState<TestNotifyResult | null>(null)

  function handleReset() {
    startResetTransition(async () => {
      await resetChannelFailures(channelId)
    })
  }

  async function handleTest() {
    setTestState('loading')
    try {
      const res = await testNotifyChannel(channelId)
      setTestResult(res)
      setTestState('done')
    } catch {
      setTestResult({ success: false, latencyMs: 0, error: 'Action failed' })
      setTestState('done')
    }
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      {/* Test result inline */}
      {testState === 'done' && testResult && (
        <span className={`text-[11px] ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
          {testResult.success ? '✓' : '✗'} {testResult.latencyMs}ms
          {testResult.error && <span className="opacity-70 ml-1 break-all" title={testResult.error}>({testResult.error.slice(0, 80)})</span>}
        </span>
      )}

      {/* Reset button — only when failures > 0 */}
      {failures > 0 && (
        <button
          onClick={handleReset}
          disabled={resetPending}
          className="text-[11px] px-2 py-1 rounded border hover:bg-accent disabled:opacity-50"
        >
          {resetPending ? '…' : 'Reset'}
        </button>
      )}

      {/* Test button — only for verified channels */}
      {isVerified && (
        <button
          onClick={handleTest}
          disabled={testState === 'loading'}
          className="text-[11px] px-2 py-1 rounded border hover:bg-accent disabled:opacity-50"
        >
          {testState === 'loading' ? '…' : 'Test'}
        </button>
      )}
    </div>
  )
}
