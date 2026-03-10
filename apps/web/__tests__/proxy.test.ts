// apps/web/__tests__/proxy.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockUpdateSession = vi.fn()

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}))

describe('proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to updateSession with the request object', async () => {
    const mockResponse = NextResponse.next()
    mockUpdateSession.mockResolvedValue(mockResponse)

    const { proxy } = await import('../proxy')
    const request = new NextRequest(new URL('/dashboard', 'https://caffecode.net'))
    await proxy(request)

    expect(mockUpdateSession).toHaveBeenCalledTimes(1)
    expect(mockUpdateSession).toHaveBeenCalledWith(request)
  })

  it('returns the NextResponse from updateSession', async () => {
    const mockResponse = NextResponse.next()
    mockUpdateSession.mockResolvedValue(mockResponse)

    const { proxy } = await import('../proxy')
    const request = new NextRequest(new URL('/dashboard', 'https://caffecode.net'))
    const result = await proxy(request)

    expect(result).toBe(mockResponse)
  })

  it('config.matcher excludes static assets but matches routes', async () => {
    const { config } = await import('../proxy')
    const pattern = config.matcher[0]

    // The matcher is a Next.js path pattern with negative lookahead.
    // Reconstruct the equivalent JS regex: strip the leading '/' capture group
    // wrapper and anchor to full path for correct matching.
    // Pattern: /((?!_next/static|_next/image|favicon.ico|.*\.<ext>$).*)
    // Equivalent anchored regex: /^\/(?!_next\/static|...).*/
    const inner = pattern.replace(/^\/(|$)/g, '') // strip leading/trailing /
    const anchored = new RegExp('^/' + inner + '$')

    // Should match regular routes
    expect(anchored.test('/dashboard')).toBe(true)
    expect(anchored.test('/admin')).toBe(true)
    expect(anchored.test('/api/health')).toBe(true)
    expect(anchored.test('/login')).toBe(true)

    // Should NOT match static assets (negative lookahead excludes these)
    expect(anchored.test('/_next/static/chunk.js')).toBe(false)
    expect(anchored.test('/_next/image/photo.png')).toBe(false)
    expect(anchored.test('/favicon.ico')).toBe(false)
    expect(anchored.test('/logo.svg')).toBe(false)
    expect(anchored.test('/hero.png')).toBe(false)
    expect(anchored.test('/photo.jpg')).toBe(false)
    expect(anchored.test('/image.webp')).toBe(false)

    // Verify the pattern contains the required exclusion strings
    expect(pattern).toContain('_next/static')
    expect(pattern).toContain('_next/image')
    expect(pattern).toContain('favicon.ico')
    expect(pattern).toMatch(/svg|png|jpg|jpeg|gif|webp/)
  })
})
