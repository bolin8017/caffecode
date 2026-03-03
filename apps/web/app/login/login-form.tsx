'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm({ error, redirectTo }: { error?: string; redirectTo?: string }) {
  const supabase = createClient()

  const handleOAuth = async (provider: 'google' | 'github') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo || '/dashboard'}`,
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">登入</CardTitle>
          <CardDescription>使用以下方式登入你的帳號</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              登入失敗，請重試。
            </p>
          )}
          <Button className="w-full" onClick={() => handleOAuth('google')}>
            使用 Google 登入
          </Button>
          <Button className="w-full" variant="outline" onClick={() => handleOAuth('github')}>
            使用 GitHub 登入
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
