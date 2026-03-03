export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
      {/* Health row skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border-2 p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            <div className="h-6 w-20 rounded bg-muted animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border p-5 space-y-2">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-8 w-16 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
