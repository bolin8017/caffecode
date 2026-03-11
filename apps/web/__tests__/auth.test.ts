// apps/web/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockCreateClient = vi.fn()
const mockLoggerError = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: mockLoggerError },
}))

function setupAuth(
  user: { id: string; email?: string } | null,
  error: { message: string } | null = null
) {
  const supabaseInstance = {
    auth: { getUser: mockGetUser },
    from: vi.fn(),
  }
  mockCreateClient.mockResolvedValue(supabaseInstance)
  mockGetUser.mockResolvedValue({ data: { user }, error })
  return supabaseInstance
}

describe('getAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns supabase client and user when authenticated', async () => {
    const mockUser = { id: 'u1', email: 'test@example.com' }
    const supabaseInstance = setupAuth(mockUser)

    const { getAuthUser } = await import('../lib/auth')
    const result = await getAuthUser()

    expect(result.user).toEqual(mockUser)
    expect(result.supabase).toBe(supabaseInstance)
  })

  it('throws Unauthenticated when getUser returns error', async () => {
    setupAuth(null, { message: 'session expired' })

    const { getAuthUser } = await import('../lib/auth')
    await expect(getAuthUser()).rejects.toThrow('Unauthenticated')
  })

  it('throws Unauthenticated when user is null', async () => {
    setupAuth(null)

    const { getAuthUser } = await import('../lib/auth')
    await expect(getAuthUser()).rejects.toThrow('Unauthenticated')
  })

  it('logs error message via logger.error when auth fails with error object', async () => {
    setupAuth(null, { message: 'token refresh failed' })

    const { getAuthUser } = await import('../lib/auth')
    await expect(getAuthUser()).rejects.toThrow()

    expect(mockLoggerError).toHaveBeenCalledWith(
      { error: 'token refresh failed' },
      'Auth user fetch failed'
    )
  })

  it('does NOT log when user is simply null (no error object)', async () => {
    setupAuth(null)

    const { getAuthUser } = await import('../lib/auth')
    await expect(getAuthUser()).rejects.toThrow('Unauthenticated')

    expect(mockLoggerError).not.toHaveBeenCalled()
  })

  it('returns the same supabase client instance from createClient', async () => {
    const mockUser = { id: 'u1' }
    const supabaseInstance = setupAuth(mockUser)

    const { getAuthUser } = await import('../lib/auth')
    const result = await getAuthUser()

    // The returned supabase should be the exact same object reference
    expect(result.supabase).toBe(supabaseInstance)
  })

  it('calls createClient (cookie-aware), not createServiceClient', async () => {
    setupAuth({ id: 'u1' })

    const { getAuthUser } = await import('../lib/auth')
    await getAuthUser()

    expect(mockCreateClient).toHaveBeenCalledTimes(1)

    const { createServiceClient } = await import('@/lib/supabase/server')
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
