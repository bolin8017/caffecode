import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track which client is used for auth vs DB
const cookieGetUser = vi.fn()
const serviceFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: cookieGetUser },
  })),
  createServiceClient: vi.fn(() => ({
    from: serviceFrom,
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}))

function setupAuth(user: { id: string; email?: string } | null, error: object | null = null) {
  cookieGetUser.mockResolvedValue({ data: { user }, error })
}

function setupProfile(isAdmin: boolean | null) {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({
    data: isAdmin === null ? null : { is_admin: isAdmin },
    error: isAdmin === null ? { message: 'not found' } : null,
  })
  serviceFrom.mockReturnValue(chain)
}

describe('verifyAdminAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses cookie-aware createClient for auth, not createServiceClient', async () => {
    setupAuth({ id: 'u1' })
    setupProfile(true)

    const { verifyAdminAccess } = await import('../lib/auth')
    await verifyAdminAccess()

    expect(cookieGetUser).toHaveBeenCalledTimes(1)
    // serviceFrom is called for DB query, but serviceClient.auth.getUser should NOT be called
    const { createServiceClient } = await import('@/lib/supabase/server')
    const serviceClient = vi.mocked(createServiceClient).mock.results[0]?.value
    // Service client should not have auth.getUser called
    expect(serviceClient?.auth?.getUser).toBeUndefined()
  })

  it('returns redirect to /login when unauthenticated', async () => {
    setupAuth(null)

    const { verifyAdminAccess } = await import('../lib/auth')
    const result = await verifyAdminAccess()

    expect(result).toEqual({ authorized: false, redirectTo: '/login' })
  })

  it('returns redirect to /login on auth error', async () => {
    setupAuth(null, { message: 'session expired' })

    const { verifyAdminAccess } = await import('../lib/auth')
    const result = await verifyAdminAccess()

    expect(result).toEqual({ authorized: false, redirectTo: '/login' })
  })

  it('returns redirect to /dashboard when user is not admin', async () => {
    setupAuth({ id: 'u1' })
    setupProfile(false)

    const { verifyAdminAccess } = await import('../lib/auth')
    const result = await verifyAdminAccess()

    expect(result).toEqual({ authorized: false, redirectTo: '/dashboard' })
  })

  it('returns redirect to /dashboard when profile query fails', async () => {
    setupAuth({ id: 'u1' })
    setupProfile(null)

    const { verifyAdminAccess } = await import('../lib/auth')
    const result = await verifyAdminAccess()

    expect(result).toEqual({ authorized: false, redirectTo: '/dashboard' })
  })

  it('returns authorized with user when admin', async () => {
    const mockUser = { id: 'u1', email: 'admin@test.com' }
    setupAuth(mockUser)
    setupProfile(true)

    const { verifyAdminAccess } = await import('../lib/auth')
    const result = await verifyAdminAccess()

    expect(result).toEqual({ authorized: true, user: mockUser })
  })

  it('uses service_role client for is_admin DB query', async () => {
    setupAuth({ id: 'u1' })
    setupProfile(true)

    const { verifyAdminAccess } = await import('../lib/auth')
    await verifyAdminAccess()

    expect(serviceFrom).toHaveBeenCalledWith('users')
  })
})
