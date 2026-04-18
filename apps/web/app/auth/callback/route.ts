import { createClient } from '@/lib/supabase/server'
import { sanitizeRedirect } from '@/lib/utils/safe-redirect'
import { checkRateLimit, getClientIp } from '@/lib/utils/rate-limiter'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const ip = getClientIp(request.headers)
  if (!(await checkRateLimit(ip, 30))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = sanitizeRedirect(searchParams.get('redirect'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
