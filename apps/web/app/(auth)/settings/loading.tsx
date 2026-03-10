export default function SettingsLoading() {
  return (
    <div className="space-y-10 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-8 w-32 rounded-md bg-muted" />
        <div className="h-4 w-56 rounded bg-muted mt-2" />
      </div>

      {/* Push settings form skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-6 w-11 rounded-full bg-muted" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-5 w-20 rounded bg-muted" />
          <div className="h-10 w-24 rounded-lg bg-muted" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-5 w-20 rounded bg-muted" />
          <div className="h-10 w-48 rounded-lg bg-muted" />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Channels skeleton */}
      <div className="space-y-4">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="rounded-lg border divide-y">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-4">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
