'use client'

import { useTransition } from 'react'
import { deleteUser } from '@/lib/actions/admin'

interface Props {
  userId: string
  isAdmin: boolean
}

export function DeleteButton({ userId, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition()

  if (isAdmin) return null

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm('確定要刪除此用戶？此操作不可復原，所有相關資料（通知頻道、歷史紀錄）將一併刪除。')) return
        startTransition(() => deleteUser(userId))
      }}
      className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
    >
      {isPending ? '...' : '刪除'}
    </button>
  )
}
