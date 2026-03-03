export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="animate-pulse space-y-8">
        <div className="h-9 w-64 rounded-md bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border p-5 space-y-3">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-8 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-5 space-y-3">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-3 w-full rounded-full bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="rounded-lg border p-5 space-y-4">
          <div className="h-5 w-32 rounded bg-muted" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
