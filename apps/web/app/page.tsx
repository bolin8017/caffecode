import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const features = [
  {
    title: '精選題目清單',
    description: 'Blind 75、NeetCode 150 等 45 份精選清單，涵蓋演算法、資料結構與各大廠面試高頻題型。',
    icon: '📋',
  },
  {
    title: '每日通知',
    description: '設定通知時間，每天自動送一題到 Email、Telegram 或 LINE。不用主動打開 LeetCode，習慣自然養成。',
    icon: '🔔',
  },
  {
    title: '進度追蹤',
    description: '追蹤你在每份清單的進度，查看歷史紀錄，看見自己一步步成長。',
    icon: '📈',
  },
  {
    title: 'AI 解題說明',
    description: '每道題目都附有 AI 生成的解題思路、C++ 範例程式碼與複雜度分析。',
    icon: '🤖',
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main>
      {/* Hero */}
      <section className="bg-background py-24 px-6 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            每天一杯咖啡配一道題
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            把刷題變成習慣，輕鬆備好技術面試
          </p>
          <p className="mt-4 text-muted-foreground">
            跟著精選清單刷題，搭配每日通知與 AI 解說，建立穩定的練習習慣
          </p>
          <p className="mt-2 text-sm text-muted-foreground/70 italic">
            久了之後，有些答案，只是比較有邏輯的咖啡話
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href={user ? '/dashboard' : '/login'}>
                {user ? '前往主頁' : '免費開始'}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/problems">瀏覽題庫</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold mb-12">為什麼選擇 CaffeCode？</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title} className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-3xl">{f.icon}</div>
                  <CardTitle className="text-base mt-2">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — 未登入才顯示 */}
      {!user && (
        <section className="border-t py-20 px-6 text-center">
          <div className="mx-auto max-w-lg">
            <h2 className="text-2xl font-bold">準備好了嗎？</h2>
            <p className="mt-2 text-muted-foreground">立即加入，今天就建立你的刷題習慣。</p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/login">用 Google 或 GitHub 登入</Link>
            </Button>
          </div>
        </section>
      )}
    </main>
  )
}
