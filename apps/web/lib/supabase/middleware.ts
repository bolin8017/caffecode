import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Auth-required routes
  const authRoutes = ['/dashboard', '/settings', '/onboarding', '/garden']
  const isAuthRoute = authRoutes.some(r => pathname.startsWith(r))

  // Admin routes
  const isAdminRoute = pathname.startsWith('/admin')

  // Redirect unauthenticated users
  if (!user && (isAuthRoute || isAdminRoute)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // For all authenticated users: single query for all user data
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('onboarding_completed, is_admin, display_name, avatar_url')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[proxy] profile query failed:', profileError.message)
    }

    // Onboarding check (only for auth routes, not onboarding itself or API)
    if (isAuthRoute && !pathname.startsWith('/onboarding') && !pathname.startsWith('/api')) {
      if (profile && !profile.onboarding_completed) {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }
    }

    // Admin check
    if (isAdminRoute && !profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Pass user profile to Nav via header (eliminates Nav's separate DB query)
    // encodeURIComponent ensures non-ASCII characters (e.g. CJK display names)
    // are safely transmitted as ASCII bytes in the HTTP header.
    if (profile) {
      supabaseResponse.headers.set('x-user-profile', encodeURIComponent(JSON.stringify({
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        is_admin: profile.is_admin,
      })))
    }
  }

  return supabaseResponse
}
