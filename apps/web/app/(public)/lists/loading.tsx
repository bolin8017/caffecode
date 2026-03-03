export default function ListsLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="h-9 w-40 rounded-md bg-muted animate-pulse mb-2" />
      <div className="h-5 w-56 rounded bg-muted animate-pulse mb-8" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-5 space-y-3 animate-pulse">
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-1/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    </main>
  )
}
