import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ProblemNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div>
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="mt-2 text-2xl font-semibold">找不到這道題目</h2>
        <p className="mt-2 text-muted-foreground">網址可能有誤，或此題目尚無解題說明。</p>
      </div>
      <Button asChild>
        <Link href="/problems">回到題庫</Link>
      </Button>
    </div>
  )
}
