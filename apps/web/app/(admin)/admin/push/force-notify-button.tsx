'use client'

import { useState } from 'react'
import { forceNotifyAll, type ForceNotifyResult } from '@/lib/actions/admin'

export function ForceNotifyButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ForceNotifyResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleClick() {
    if (!confirm('立即傳送通知給所有啟用通知的用戶（忽略通知時間設定）？')) return
    setState('loading')
    setErrorMsg(null)
    try {
      const res = await forceNotifyAll()
      setResult(res)
      setState('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '傳送失敗')
      setState('error')
    }
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-destructive">✗ {errorMsg}</span>
        <button
          onClick={() => { setState('idle'); setErrorMsg(null) }}
          className="text-xs text-muted-foreground underline"
        >
          重試
        </button>
      </div>
    )
  }

  if (state === 'done' && result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            傳送結果：{result.summary.sent} 成功 · {result.summary.failed} 失敗 · {result.summary.skipped} 略過
          </span>
          <button
            onClick={() => { setState('idle'); setResult(null) }}
            className="text-xs text-muted-foreground underline"
          >
            重置
          </button>
        </div>
        {result.results.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left px-4 py-2">狀態</th>
                  <th className="text-left px-4 py-2">用戶</th>
                  <th className="text-left px-4 py-2">通道結果</th>
                  <th className="text-left px-4 py-2">題目</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.results.map((r) => (
                  <tr
                    key={r.userId}
                    className={
                      r.status === 'failed' ? 'bg-destructive/5' :
                      r.status === 'skipped' ? 'bg-muted/30' : 'hover:bg-muted/20'
                    }
                  >
                    <td className="px-4 py-2 text-xs">
                      {r.status === 'success' && <span className="text-green-600 font-bold">✓</span>}
                      {r.status === 'failed' && <span className="text-destructive font-bold">✗</span>}
                      {r.status === 'skipped' && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2 text-xs font-medium">{r.displayName}</td>
                    <td className="px-4 py-2 text-xs">
                      {r.channels.length === 0 ? (
                        <span className="text-muted-foreground">no channels</span>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {r.channels.map((ch, ci) => (
                            <span
                              key={ci}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${
                                ch.success
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-destructive/10 text-destructive'
                              }`}
                              title={ch.error ?? ''}
                            >
                              {ch.type} {ch.success ? '✓' : '✗'}
                              {ch.error && <span className="opacity-70">({ch.error.slice(0, 20)})</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.problemTitle ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {state === 'loading' ? '傳送中…' : '立即通知全部'}
    </button>
  )
}
