// apps/web/__tests__/login-page.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

// next/navigation redirect throws a special NEXT_REDIRECT error
const REDIRECT_ERROR = 'NEXT_REDIRECT'
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(REDIRECT_ERROR) as Error & { digest: string }
    err.digest = `${REDIRECT_ERROR};replace;${url}`
    throw err
  }),
}))

// Mock the LoginForm component to capture its props
vi.mock('../app/login/login-form', () => ({
  LoginForm: vi.fn(({ error, redirectTo }: { error?: string; redirectTo?: string }) => ({
    type: 'LoginForm',
    props: { error, redirectTo },
  })),
}))

function setupUser(user: { id: string } | null) {
  mockGetUser.mockResolvedValue({ data: { user } })
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /dashboard when user already authenticated', async () => {
    setupUser({ id: 'u1' })

    const { default: LoginPage } = await import('../app/login/page')

    await expect(
      LoginPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow(REDIRECT_ERROR)

    const { redirect } = await import('next/navigation')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('does not redirect when user is null (unauthenticated)', async () => {
    setupUser(null)

    const { default: LoginPage } = await import('../app/login/page')
    // Should not throw (no redirect)
    const result = await LoginPage({ searchParams: Promise.resolve({}) })
    expect(result).toBeDefined()
  })

  it('passes error search param to LoginForm component', async () => {
    setupUser(null)

    const { default: LoginPage } = await import('../app/login/page')
    const result = await LoginPage({
      searchParams: Promise.resolve({ error: 'auth_failed' }),
    }) as unknown as { props: { error?: string } }

    expect(result.props.error).toBe('auth_failed')
  })

  it('passes redirect search param to LoginForm component', async () => {
    setupUser(null)

    const { default: LoginPage } = await import('../app/login/page')
    const result = await LoginPage({
      searchParams: Promise.resolve({ redirect: '/settings' }),
    }) as unknown as { props: { redirectTo?: string } }

    expect(result.props.redirectTo).toBe('/settings')
  })

  it('handles missing search params gracefully', async () => {
    setupUser(null)

    const { default: LoginPage } = await import('../app/login/page')
    const result = await LoginPage({
      searchParams: Promise.resolve({}),
    }) as unknown as { props: { error?: string; redirectTo?: string } }

    expect(result.props.error).toBeUndefined()
    expect(result.props.redirectTo).toBeUndefined()
  })
})
