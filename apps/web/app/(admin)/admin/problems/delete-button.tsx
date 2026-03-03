'use client'

import { useTransition } from 'react'
import { deleteProblem } from '@/lib/actions/admin'

export function DeleteProblemButton({ id, title }: { id: number; title: string }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`Delete "${title}"?`)) return
    startTransition(() => deleteProblem(id))
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-destructive hover:underline disabled:opacity-50"
    >
      {isPending ? 'Deleting…' : 'Delete'}
    </button>
  )
}
