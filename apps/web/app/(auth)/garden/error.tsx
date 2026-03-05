'use client'

export default function GardenError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-center">
      <p className="text-4xl mb-4">🌧️</p>
      <h1 className="text-xl font-bold mb-2">莊園載入失敗</h1>
      <p className="text-sm text-muted-foreground mb-6">
        資料讀取時發生錯誤，請稍後再試
      </p>
      <button
        onClick={reset}
        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        重新載入
      </button>
    </main>
  )
}
