'use client'

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4 text-center py-20">
      <p className="text-4xl">&#x26A0;&#xFE0F;</p>
      <h1 className="text-xl font-bold">管理後台載入失敗</h1>
      <p className="text-sm text-muted-foreground">
        資料讀取時發生錯誤，請稍後再試
      </p>
      <button
        onClick={reset}
        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        重新載入
      </button>
    </div>
  )
}
