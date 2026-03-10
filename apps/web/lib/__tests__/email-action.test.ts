// apps/web/lib/__tests__/email-action.test.ts
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

function setupAuth(userId = 'user-123', email: string | null = 'test@example.com') {
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: {} as unknown,
    // null email simulates no email on account (falsy check in action)
    user: { id: userId, email: email ?? undefined } as unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

describe('connectEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    vi.mocked(upsertChannel).mockResolvedValue(undefined)
  })

  // ─── Happy path ───

  it('creates verified channel and returns email', async () => {
    const { connectEmail } = await import('@/lib/actions/email')
    const result = await connectEmail()

    expect(result).toEqual({ email: 'test@example.com' })
  })

  it('creates channel with is_verified=true', async () => {
    const { connectEmail } = await import('@/lib/actions/email')
    await connectEmail()

    expect(upsertChannel).toHaveBeenCalledWith(
      mockServiceClient,
      expect.objectContaining({
        user_id: 'user-123',
        channel_type: 'email',
        channel_identifier: 'test@example.com',
        is_verified: true,
      })
    )
  })

  it('creates channel with link_token=null', async () => {
    const { connectEmail } = await import('@/lib/actions/email')
    await connectEmail()

    expect(upsertChannel).toHaveBeenCalledWith(
      mockServiceClient,
      expect.objectContaining({
        link_token: null,
      })
    )
  })

  it('revalidates /settings', async () => {
    const { connectEmail } = await import('@/lib/actions/email')
    await connectEmail()

    expect(revalidatePath).toHaveBeenCalledWith('/settings')
  })

  // ─── Error handling ───

  it('throws when user has no email', async () => {
    setupAuth('user-123', null)

    const { connectEmail } = await import('@/lib/actions/email')
    await expect(connectEmail()).rejects.toThrow('No email associated with this account')
  })

  it('throws when upsertChannel fails', async () => {
    vi.mocked(upsertChannel).mockRejectedValue(new Error('upsert failed'))

    const { connectEmail } = await import('@/lib/actions/email')
    await expect(connectEmail()).rejects.toThrow('Email 連結失敗')
  })

  // ─── Security ───

  it('throws when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockRejectedValue(new Error('Unauthenticated'))

    const { connectEmail } = await import('@/lib/actions/email')
    await expect(connectEmail()).rejects.toThrow('Unauthenticated')
  })

  // ─── Implementation details ───

  it('uses createServiceClient', async () => {
    const { connectEmail } = await import('@/lib/actions/email')
    await connectEmail()

    expect(createServiceClient).toHaveBeenCalled()
    expect(upsertChannel).toHaveBeenCalledWith(mockServiceClient, expect.anything())
  })
})
