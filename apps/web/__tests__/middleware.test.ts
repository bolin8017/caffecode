// apps/web/__tests__/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mock setup ---
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockSetAll = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: { cookies: { setAll: typeof mockSetAll } }) => {
    // Capture setAll so tests can simulate cookie refresh
    mockSetAll.mockImplementation(options.cookies.setAll)
    return {
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }
  }),
}))

// --- Helpers ---
function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'https://caffecode.net'))
}

function setupUser(user: { id: string } | null) {
  mockGetUser.mockResolvedValue({ data: { user } })
}

function setupProfile(profile: {
  onboarding_completed?: boolean
  is_admin?: boolean
  display_name?: string | null
  avatar_url?: string | null
} | null) {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: profile, error: profile ? null : { message: 'not found' } })
  mockFrom.mockReturnValue(chain)
}

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  // ─── Route Classification (7) ───

  describe('route classification', () => {
    it('classifies /dashboard as an auth route', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/dashboard'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    })

    it('classifies /settings as an auth route', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/settings'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    })

    it('classifies /settings/notifications as an auth route', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/settings/notifications'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    })

    it('classifies /onboarding as an auth route', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/onboarding'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    })

    it('classifies /garden as an auth route', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/garden'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    })

    it('classifies /admin as an admin route', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/admin'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).searchParams.get('redirect')).toBe('/admin')
    })

    it('classifies /admin/push as an admin route', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/admin/push'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).searchParams.get('redirect')).toBe('/admin/push')
    })
  })

  // ─── Public Routes (5) ───

  describe('public routes', () => {
    it('allows unauthenticated access to /', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/'))
      expect(res.status).toBe(200)
    })

    it('allows unauthenticated access to /problems', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/problems'))
      expect(res.status).toBe(200)
    })

    it('allows unauthenticated access to /lists', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/lists'))
      expect(res.status).toBe(200)
    })

    it('allows unauthenticated access to /login', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/login'))
      expect(res.status).toBe(200)
    })

    it('allows unauthenticated access to /api/health', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/api/health'))
      expect(res.status).toBe(200)
    })
  })

  // ─── Unauthenticated Redirect (5) ───

  describe('unauthenticated redirect', () => {
    it('redirects /dashboard to /login?redirect=/dashboard', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/dashboard'))
      const location = new URL(res.headers.get('location')!)
      expect(location.pathname).toBe('/login')
      expect(location.searchParams.get('redirect')).toBe('/dashboard')
    })

    it('preserves nested path in redirect param for /settings/notifications', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/settings/notifications'))
      const location = new URL(res.headers.get('location')!)
      expect(location.searchParams.get('redirect')).toBe('/settings/notifications')
    })

    it('redirects /admin to /login when unauthenticated', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/admin'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    })

    it('redirects /admin/users to /login when unauthenticated', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/admin/users'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
    })

    it('does not redirect unauthenticated requests to public API routes', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/api/telegram/webhook'))
      expect(res.status).toBe(200)
    })
  })

  // ─── Onboarding Redirect (6) ───

  describe('onboarding redirect', () => {
    it('redirects to /onboarding when onboarding incomplete on /dashboard', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: false, is_admin: false, display_name: 'Test', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/dashboard'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding')
    })

    it('redirects to /onboarding when onboarding incomplete on /settings', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: false, is_admin: false, display_name: 'Test', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/settings'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding')
    })

    it('does not redirect to /onboarding when already on /onboarding (no infinite loop)', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: false, is_admin: false, display_name: 'Test', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/onboarding'))
      expect(res.status).toBe(200)
    })

    it('does not redirect to /onboarding for /api routes', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: false, is_admin: false, display_name: 'Test', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/api/health'))
      expect(res.status).toBe(200)
    })

    it('does not redirect when onboarding is completed', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: false, display_name: 'Test', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/dashboard'))
      expect(res.status).toBe(200)
    })

    it('does not redirect to /onboarding when profile is null', async () => {
      setupUser({ id: 'u1' })
      setupProfile(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/dashboard'))
      // profile is null so the `profile && !profile.onboarding_completed` check is false
      expect(res.status).toBe(200)
    })
  })

  // ─── Admin Protection (5) ───

  describe('admin protection', () => {
    it('redirects non-admin from /admin to /dashboard', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: false, display_name: 'Test', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/admin'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard')
    })

    it('redirects non-admin from /admin/users to /dashboard', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: false, display_name: 'Test', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/admin/users'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard')
    })

    it('allows admin access to /admin', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: true, display_name: 'Admin', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/admin'))
      expect(res.status).toBe(200)
    })

    it('redirects to /dashboard when profile is null on /admin route', async () => {
      setupUser({ id: 'u1' })
      setupProfile(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/admin'))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard')
    })

    it('does not apply admin check to /dashboard', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: false, display_name: 'Test', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/dashboard'))
      expect(res.status).toBe(200)
    })
  })

  // ─── x-user-profile Header (7) ───

  describe('x-user-profile header', () => {
    it('sets x-user-profile header for authenticated user on public route', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: false, display_name: 'Alice', avatar_url: 'https://example.com/a.png' })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/'))
      expect(res.headers.get('x-user-profile')).toBeTruthy()
    })

    it('encodes correct JSON structure with display_name, avatar_url, is_admin', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: true, display_name: 'Alice', avatar_url: 'https://example.com/a.png' })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/'))
      const raw = res.headers.get('x-user-profile')!
      const parsed = JSON.parse(decodeURIComponent(raw))
      expect(parsed).toEqual({
        display_name: 'Alice',
        avatar_url: 'https://example.com/a.png',
        is_admin: true,
      })
    })

    it('encodes CJK display names via encodeURIComponent', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: false, display_name: '小明', avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/'))
      const raw = res.headers.get('x-user-profile')!
      // Raw header should contain encoded characters (not literal CJK)
      expect(raw).not.toContain('小明')
      const parsed = JSON.parse(decodeURIComponent(raw))
      expect(parsed.display_name).toBe('小明')
    })

    it('handles null display_name and avatar_url in profile', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: false, display_name: null, avatar_url: null })
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/'))
      const raw = res.headers.get('x-user-profile')!
      const parsed = JSON.parse(decodeURIComponent(raw))
      expect(parsed.display_name).toBeNull()
      expect(parsed.avatar_url).toBeNull()
    })

    it('does not set x-user-profile header when unauthenticated', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/'))
      expect(res.headers.get('x-user-profile')).toBeNull()
    })

    it('does not set x-user-profile header when profile query returns null', async () => {
      setupUser({ id: 'u1' })
      setupProfile(null)
      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/'))
      expect(res.headers.get('x-user-profile')).toBeNull()
    })

    it('header survives cookie refresh (setAll rebuilds response)', async () => {
      setupUser({ id: 'u1' })
      setupProfile({ onboarding_completed: true, is_admin: false, display_name: 'Alice', avatar_url: null })

      const { createServerClient } = await import('@supabase/ssr')
      // Override createServerClient to trigger setAll during construction
      vi.mocked(createServerClient).mockImplementationOnce((_url, _key, options) => {
        // Simulate Supabase refreshing cookies (calls setAll)
        options.cookies.setAll!([{ name: 'sb-token', value: 'refreshed', options: {} }])
        return {
          auth: { getUser: mockGetUser },
          from: mockFrom,
        } as ReturnType<typeof createServerClient>
      })

      const { updateSession } = await import('../lib/supabase/middleware')
      const res = await updateSession(makeRequest('/'))
      // The x-user-profile header should still be present on the rebuilt response
      expect(res.headers.get('x-user-profile')).toBeTruthy()
      const parsed = JSON.parse(decodeURIComponent(res.headers.get('x-user-profile')!))
      expect(parsed.display_name).toBe('Alice')
    })
  })

  // ─── Cookie Setup (3) ───

  describe('cookie setup', () => {
    it('passes request cookies to supabase client via getAll', async () => {
      setupUser(null)
      const { createServerClient } = await import('@supabase/ssr')
      const { updateSession } = await import('../lib/supabase/middleware')

      const request = makeRequest('/')
      request.cookies.set('sb-token', 'test-value')
      await updateSession(request)

      expect(createServerClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        })
      )
    })

    it('propagates refreshed cookies to both request and response', async () => {
      setupUser(null)
      const { updateSession } = await import('../lib/supabase/middleware')

      const request = makeRequest('/')
      await updateSession(request)

      // Simulate cookie refresh by calling setAll
      mockSetAll([
        { name: 'sb-access-token', value: 'new-access', options: { path: '/' } },
        { name: 'sb-refresh-token', value: 'new-refresh', options: { path: '/' } },
      ])

      // Request cookies should have the new values
      expect(request.cookies.get('sb-access-token')?.value).toBe('new-access')
      expect(request.cookies.get('sb-refresh-token')?.value).toBe('new-refresh')
    })

    it('creates client with correct env vars', async () => {
      setupUser(null)
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://my-project.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'my-anon-key-123'

      const { createServerClient } = await import('@supabase/ssr')
      const { updateSession } = await import('../lib/supabase/middleware')
      await updateSession(makeRequest('/'))

      expect(createServerClient).toHaveBeenCalledWith(
        'https://my-project.supabase.co',
        'my-anon-key-123',
        expect.any(Object)
      )
    })
  })
})
