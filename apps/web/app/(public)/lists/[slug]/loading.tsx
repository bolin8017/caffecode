export default function ListDetailLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="animate-pulse space-y-4 mb-8">
        <div className="h-9 w-56 rounded-md bg-muted" />
        <div className="h-5 w-80 rounded bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 flex gap-4">
          {['w-10', 'flex-1', 'w-20'].map((w, i) => (
            <div key={i} className={`h-4 ${w} rounded bg-muted animate-pulse`} />
          ))}
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="border-t px-4 py-3 flex gap-4 items-center animate-pulse">
            <div className="h-4 w-10 rounded bg-muted" />
            <div className="h-4 flex-1 rounded bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </main>
  )
}
