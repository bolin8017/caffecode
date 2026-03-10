// apps/web/lib/__tests__/telegram-action.test.ts
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

// Do NOT mock next/cache — telegram action should not call revalidatePath
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

describe('connectTelegram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    vi.mocked(upsertChannel).mockResolvedValue(undefined)
    process.env.TELEGRAM_BOT_USERNAME = 'CaffeCodeBot'
  })

  // ─── Happy path ───

  it('returns deepLink with correct format', async () => {
    const { connectTelegram } = await import('@/lib/actions/telegram')
    const result = await connectTelegram()

    expect(result.deepLink).toMatch(/^https:\/\/t\.me\/CaffeCodeBot\?start=link_/)
  })

  it('creates channel with is_verified=false', async () => {
    const { connectTelegram } = await import('@/lib/actions/telegram')
    await connectTelegram()

    expect(upsertChannel).toHaveBeenCalledWith(
      mockServiceClient,
      expect.objectContaining({
        user_id: 'user-123',
        channel_type: 'telegram',
        channel_identifier: '',
        is_verified: false,
      })
    )
  })

  it('link token has format link_{uuid}', async () => {
    const { connectTelegram } = await import('@/lib/actions/telegram')
    const result = await connectTelegram()

    expect(result.linkToken).toMatch(/^link_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('sets expiry approximately 30 min from now', async () => {
    const now = Date.now()
    const { connectTelegram } = await import('@/lib/actions/telegram')
    await connectTelegram()

    const call = vi.mocked(upsertChannel).mock.calls[0][1]
    const expiresAt = new Date(call.link_token_expires_at as string).getTime()
    const thirtyMin = 30 * 60 * 1000
    // Allow 5 seconds tolerance
    expect(expiresAt).toBeGreaterThan(now + thirtyMin - 5000)
    expect(expiresAt).toBeLessThan(now + thirtyMin + 5000)
  })

  // ─── Error handling ───

  it('throws when TELEGRAM_BOT_USERNAME env var is missing', async () => {
    delete process.env.TELEGRAM_BOT_USERNAME

    const { connectTelegram } = await import('@/lib/actions/telegram')
    await expect(connectTelegram()).rejects.toThrow('TELEGRAM_BOT_USERNAME is not configured')
  })

  it('throws when upsertChannel fails', async () => {
    vi.mocked(upsertChannel).mockRejectedValue(new Error('upsert failed'))

    const { connectTelegram } = await import('@/lib/actions/telegram')
    await expect(connectTelegram()).rejects.toThrow('Telegram 連結失敗')
  })

  // ─── Security ───

  it('throws when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockRejectedValue(new Error('Unauthenticated'))

    const { connectTelegram } = await import('@/lib/actions/telegram')
    await expect(connectTelegram()).rejects.toThrow('Unauthenticated')
  })

  // ─── Implementation details ───

  it('uses createServiceClient not createClient', async () => {
    const { connectTelegram } = await import('@/lib/actions/telegram')
    await connectTelegram()

    expect(createServiceClient).toHaveBeenCalled()
    expect(upsertChannel).toHaveBeenCalledWith(mockServiceClient, expect.anything())
  })

  it('does NOT call revalidatePath', async () => {
    const { connectTelegram } = await import('@/lib/actions/telegram')
    await connectTelegram()

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
