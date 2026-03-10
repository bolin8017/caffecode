// apps/web/lib/__tests__/line-action.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

const mockServiceClient = { from: vi.fn() }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => mockServiceClient),
}))

vi.mock('@/lib/repositories/channel.repository', () => ({
  upsertChannel: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { upsertChannel } from '@/lib/repositories/channel.repository'
import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function setupAuth(userId = 'user-123') {
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: {} as unknown,
    user: { id: userId } as unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

describe('connectLine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    vi.mocked(upsertChannel).mockResolvedValue(undefined)
    process.env.LINE_BOT_BASIC_ID = '@624yzmrd'
  })

  // ─── Happy path ───

  it('returns deepLink with correct LINE format', async () => {
    const { connectLine } = await import('@/lib/actions/line')
    const result = await connectLine()

    expect(result.deepLink).toBe('https://line.me/R/ti/p/@624yzmrd')
  })

  it('creates channel with is_verified=false', async () => {
    const { connectLine } = await import('@/lib/actions/line')
    await connectLine()

    expect(upsertChannel).toHaveBeenCalledWith(
      mockServiceClient,
      expect.objectContaining({
        user_id: 'user-123',
        channel_type: 'line',
        channel_identifier: '',
        is_verified: false,
      })
    )
  })

  it('link token has format link_{uuid}', async () => {
    const { connectLine } = await import('@/lib/actions/line')
    const result = await connectLine()

    expect(result.linkToken).toMatch(/^link_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('sets expiry approximately 30 min from now', async () => {
    const now = Date.now()
    const { connectLine } = await import('@/lib/actions/line')
    await connectLine()

    const call = vi.mocked(upsertChannel).mock.calls[0][1]
    const expiresAt = new Date(call.link_token_expires_at as string).getTime()
    const thirtyMin = 30 * 60 * 1000
    expect(expiresAt).toBeGreaterThan(now + thirtyMin - 5000)
    expect(expiresAt).toBeLessThan(now + thirtyMin + 5000)
  })

  // ─── Error handling ───

  it('throws when LINE_BOT_BASIC_ID env var is missing', async () => {
    delete process.env.LINE_BOT_BASIC_ID

    const { connectLine } = await import('@/lib/actions/line')
    await expect(connectLine()).rejects.toThrow('LINE_BOT_BASIC_ID is not configured')
  })

  it('throws when upsertChannel fails', async () => {
    vi.mocked(upsertChannel).mockRejectedValue(new Error('upsert failed'))

    const { connectLine } = await import('@/lib/actions/line')
    await expect(connectLine()).rejects.toThrow('LINE 連結失敗')
  })

  // ─── Security ───

  it('throws when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockRejectedValue(new Error('Unauthenticated'))

    const { connectLine } = await import('@/lib/actions/line')
    await expect(connectLine()).rejects.toThrow('Unauthenticated')
  })

  // ─── Implementation details ───

  it('uses createServiceClient not createClient', async () => {
    const { connectLine } = await import('@/lib/actions/line')
    await connectLine()

    expect(createServiceClient).toHaveBeenCalled()
    expect(upsertChannel).toHaveBeenCalledWith(mockServiceClient, expect.anything())
  })

  it('does NOT call revalidatePath', async () => {
    const { connectLine } = await import('@/lib/actions/line')
    await connectLine()

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
