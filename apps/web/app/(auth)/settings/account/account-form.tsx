'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteAccount, exportData } from '@/lib/actions/settings'

export function AccountForm() {
  const [isPending, startTransition] = useTransition()
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold mb-2">匯出資料</h2>
        <p className="text-sm text-muted-foreground mb-4">下載你的刷題記錄、進度和回饋（JSON 格式）</p>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const data = await exportData()
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'caffecode-export.json'
              a.click()
              URL.revokeObjectURL(url)
            })
          }}
        >
          匯出資料
        </Button>
      </section>

      <section className="rounded-lg border border-destructive/30 p-5 space-y-3">
        <p className="text-sm font-medium text-destructive">刪除帳號</p>
        <p className="text-xs text-muted-foreground">
          此操作無法復原。所有資料（推播記錄、學習進度、通知設定）將永久刪除。
          輸入「DELETE」確認。
        </p>
        <div className="flex gap-3">
          <Input
            placeholder="輸入 DELETE"
            value={deleteConfirm}
            onChange={(e) => {
              setDeleteConfirm(e.target.value)
              setDeleteError(null)
            }}
            className="max-w-xs"
          />
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteConfirm !== 'DELETE' || isPending}
            onClick={() =>
              startTransition(async () => {
                setDeleteError(null)
                const result = await deleteAccount()
                // If deleteAccount succeeds it redirects; we only reach here on error
                if (result && !result.success) {
                  setDeleteError(result.error)
                }
              })
            }
          >
            {isPending ? '刪除中...' : '刪除帳號'}
          </Button>
        </div>
        {deleteError && (
          <p role="alert" className="text-xs text-destructive">{deleteError}</p>
        )}
      </section>
    </div>
  )
}
