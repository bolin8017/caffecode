// apps/web/__tests__/supabase-clients.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateServerClient = vi.fn()
const mockCookieStore = {
  getAll: vi.fn(() => [{ name: 'sb-token', value: 'abc' }]),
  set: vi.fn(),
}

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => {
    mockCreateServerClient(...args)
    return { auth: { getUser: vi.fn() } }
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}))

describe('supabase/server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  describe('createClient', () => {
    it('uses NEXT_PUBLIC_SUPABASE_URL', async () => {
      const { createClient } = await import('../lib/supabase/server')
      await createClient()

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        expect.any(String),
        expect.any(Object)
      )
    })

    it('uses NEXT_PUBLIC_SUPABASE_ANON_KEY', async () => {
      const { createClient } = await import('../lib/supabase/server')
      await createClient()

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        expect.any(String),
        'test-anon-key',
        expect.any(Object)
      )
    })

    it('getAll delegates to cookieStore.getAll()', async () => {
      const { createClient } = await import('../lib/supabase/server')
      await createClient()

      const cookiesConfig = mockCreateServerClient.mock.calls[0][2].cookies
      const result = cookiesConfig.getAll()
      expect(mockCookieStore.getAll).toHaveBeenCalled()
      expect(result).toEqual([{ name: 'sb-token', value: 'abc' }])
    })

    it('setAll writes cookies to cookieStore via set()', async () => {
      const { createClient } = await import('../lib/supabase/server')
      await createClient()

      const cookiesConfig = mockCreateServerClient.mock.calls[0][2].cookies
      cookiesConfig.setAll([
        { name: 'sb-access', value: 'token1', options: { path: '/' } },
        { name: 'sb-refresh', value: 'token2', options: { path: '/' } },
      ])

      expect(mockCookieStore.set).toHaveBeenCalledTimes(2)
      expect(mockCookieStore.set).toHaveBeenCalledWith('sb-access', 'token1', { path: '/' })
      expect(mockCookieStore.set).toHaveBeenCalledWith('sb-refresh', 'token2', { path: '/' })
    })

    it('setAll swallows errors in Server Component context (no-throw)', async () => {
      mockCookieStore.set.mockImplementation(() => {
        throw new Error('Cannot set cookies in Server Component')
      })

      const { createClient } = await import('../lib/supabase/server')
      await createClient()

      const cookiesConfig = mockCreateServerClient.mock.calls[0][2].cookies

      // Should not throw
      expect(() =>
        cookiesConfig.setAll([{ name: 'sb-token', value: 'val', options: {} }])
      ).not.toThrow()
    })
  })

  describe('createServiceClient', () => {
    it('uses SUPABASE_SERVICE_ROLE_KEY', async () => {
      const { createServiceClient } = await import('../lib/supabase/server')
      createServiceClient()

      // createServerClient is called once for the service client
      // Find the call that uses service key
      const serviceCall = mockCreateServerClient.mock.calls.find(
        (call: unknown[]) => call[1] === 'test-service-key'
      )
      expect(serviceCall).toBeDefined()
      expect(serviceCall![0]).toBe('https://test.supabase.co')
    })

    it('getAll returns empty array (no cookies needed)', async () => {
      const { createServiceClient } = await import('../lib/supabase/server')
      createServiceClient()

      const serviceCall = mockCreateServerClient.mock.calls.find(
        (call: unknown[]) => call[1] === 'test-service-key'
      )
      const cookiesConfig = serviceCall![2].cookies
      expect(cookiesConfig.getAll()).toEqual([])
    })

    it('setAll is a no-op (does nothing)', async () => {
      const { createServiceClient } = await import('../lib/supabase/server')
      createServiceClient()

      const serviceCall = mockCreateServerClient.mock.calls.find(
        (call: unknown[]) => call[1] === 'test-service-key'
      )
      const cookiesConfig = serviceCall![2].cookies

      // Should not throw and should have no side effects
      expect(() =>
        cookiesConfig.setAll([{ name: 'x', value: 'y', options: {} }])
      ).not.toThrow()

      // cookieStore.set should NOT have been called
      expect(mockCookieStore.set).not.toHaveBeenCalled()
    })
  })
})
