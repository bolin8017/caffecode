export default function ProblemsLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
        <div className="mt-1 h-5 w-40 rounded bg-muted animate-pulse" />
      </div>

      {/* Filter skeleton */}
      <div className="mb-6 flex gap-3">
        <div className="h-9 w-56 rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-32 rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-16 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 flex gap-4">
          {['w-12', 'flex-1', 'w-20', 'w-16'].map((w, i) => (
            <div key={i} className={`h-4 ${w} rounded bg-muted animate-pulse`} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border-t px-4 py-3 flex gap-4 items-center">
            <div className="h-4 w-12 rounded bg-muted animate-pulse" />
            <div className="h-4 flex-1 rounded bg-muted animate-pulse" />
            <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-12 rounded bg-muted animate-pulse hidden sm:block" />
          </div>
        ))}
      </div>
    </main>
  )
}
