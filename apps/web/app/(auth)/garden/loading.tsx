export default function GardenLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <div className="animate-pulse space-y-8">
        {/* Header */}
        <div>
          <div className="h-8 w-32 rounded-md bg-muted" />
          <div className="h-4 w-56 rounded bg-muted mt-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4 text-center space-y-2">
              <div className="h-8 w-12 rounded bg-muted mx-auto" />
              <div className="h-3 w-16 rounded bg-muted mx-auto" />
            </div>
          ))}
        </div>

        {/* Badge showcase */}
        <div className="rounded-xl border p-5 space-y-3">
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-12 rounded-full bg-muted" />
            ))}
          </div>
        </div>

        {/* Garden grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-muted mx-auto" />
              <div className="h-3 w-20 rounded bg-muted mx-auto" />
              <div className="h-2 w-16 rounded bg-muted mx-auto" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
