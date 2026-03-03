import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div>
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="mt-2 text-2xl font-semibold">頁面不存在</h2>
        <p className="mt-2 text-muted-foreground">你要找的頁面可能已被移除或網址有誤。</p>
      </div>
      <Button asChild>
        <Link href="/">回首頁</Link>
      </Button>
    </div>
  )
}
