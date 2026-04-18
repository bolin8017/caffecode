import { createServiceClient } from '@/lib/supabase/server'
import { Suspense } from 'react'

export default function AdminListsPage() {
  return (
    <Suspense fallback={null}>
      <AdminListsPageBody />
    </Suspense>
  )
}

async function AdminListsPageBody() {
  const supabase = createServiceClient()

  const { data: lists } = await supabase
    .from('curated_lists')
    .select('id, slug, name, problem_count')
    .order('id')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Curated Lists</h1>
        <span className="text-sm text-muted-foreground">{lists?.length ?? 0} lists</span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Slug</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-right px-4 py-2">Problems</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(lists ?? []).map((l) => (
              <tr key={l.id} className="hover:bg-muted/20">
                <td className="px-4 py-2 text-muted-foreground">{l.id}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.slug}</td>
                <td className="px-4 py-2">{l.name}</td>
                <td className="px-4 py-2 text-right">{l.problem_count}</td>
                <td className="px-4 py-2 text-right">
                  <a
                    href={`/lists/${l.slug}`}
                    target="_blank"
                    className="text-xs text-primary hover:underline"
                  >
                    View →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        <p>To add or modify lists, use the bulk import on the Problems page.</p>
        <p className="text-xs mt-1">List metadata is managed via <code>scripts/build_database.py</code></p>
      </div>
    </div>
  )
}
