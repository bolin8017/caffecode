// apps/web/lib/__tests__/onboarding-action.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock setup ---

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    throw new Error('NEXT_REDIRECT')
  },
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/repositories/user.repository', () => ({
  updateUser: vi.fn(),
}))

vi.mock('@/lib/repositories/list.repository', () => ({
  upsertListProgress: vi.fn(),
}))

vi.mock('@/lib/utils/timezone', () => ({
  toUtcHour: vi.fn().mockReturnValue(16),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// Supabase chain mock for the profile fetch
const mockSingle = vi.fn()
const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: mockSingle,
}
const mockFrom = vi.fn().mockReturnValue(mockChain)
const mockSupabase = { from: mockFrom }

import { getAuthUser } from '@/lib/auth'
import { updateUser } from '@/lib/repositories/user.repository'
import { upsertListProgress } from '@/lib/repositories/list.repository'
import { toUtcHour } from '@/lib/utils/timezone'

const validFilterData = {
  mode: 'filter' as const,
  list_id: null,
  difficulty_min: 1200,
  difficulty_max: 1800,
  timezone: 'Asia/Taipei',
  push_hour: 9,
}

const validListData = {
  mode: 'list' as const,
  list_id: 5,
  difficulty_min: 1200,
  difficulty_max: 1800,
  timezone: 'Asia/Taipei',
  push_hour: 9,
}

function setupAuth(userId = 'user-123') {
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: mockSupabase as unknown,
    user: { id: userId } as unknown,
  } as ReturnType<typeof getAuthUser> extends Promise<infer T> ? T : never)
}

describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    // Default: user has NOT completed onboarding
    mockSingle.mockResolvedValue({ data: { onboarding_completed: false }, error: null })
    vi.mocked(updateUser).mockResolvedValue(undefined)
    vi.mocked(upsertListProgress).mockResolvedValue(undefined)
  })

  // ─── Happy path ───

  it('updates user with difficulty/topic settings in filter mode', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(completeOnboarding(validFilterData)).rejects.toThrow('NEXT_REDIRECT')

    expect(updateUser).toHaveBeenCalledWith(
      mockSupabase,
      'user-123',
      expect.objectContaining({
        active_mode: 'filter',
        difficulty_min: 1200,
        difficulty_max: 1800,
        timezone: 'Asia/Taipei',
        push_hour: 9,
        push_hour_utc: 16,
        onboarding_completed: true,
      })
    )
    expect(upsertListProgress).not.toHaveBeenCalled()
  })

  it('updates user and upserts list progress in list mode', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(completeOnboarding(validListData)).rejects.toThrow('NEXT_REDIRECT')

    expect(updateUser).toHaveBeenCalledWith(
      mockSupabase,
      'user-123',
      expect.objectContaining({ active_mode: 'list' })
    )
    expect(upsertListProgress).toHaveBeenCalledWith(mockSupabase, {
      user_id: 'user-123',
      list_id: 5,
      is_active: true,
      current_position: 0,
    })
  })

  it('rejects list mode with null list_id (discriminated union validation)', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validListData, list_id: null })
    ).rejects.toThrow()

    expect(updateUser).not.toHaveBeenCalled()
    expect(upsertListProgress).not.toHaveBeenCalled()
  })

  // ─── Idempotency ───

  it('redirects to /garden immediately when already completed', async () => {
    mockSingle.mockResolvedValue({ data: { onboarding_completed: true }, error: null })

    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(completeOnboarding(validFilterData)).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/garden')
    expect(updateUser).not.toHaveBeenCalled()
  })

  // ─── Zod validation errors ───

  it('throws ZodError for invalid mode', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validFilterData, mode: 'invalid' as 'filter' })
    ).rejects.toThrow()
  })

  it('throws ZodError when difficulty_min > difficulty_max', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validFilterData, difficulty_min: 2000, difficulty_max: 1000 })
    ).rejects.toThrow()
  })

  it('throws ZodError for invalid timezone', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validFilterData, timezone: 'Not/A/Timezone' })
    ).rejects.toThrow()
  })

  it('throws ZodError for push_hour < 0', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validFilterData, push_hour: -1 })
    ).rejects.toThrow()
  })

  it('throws ZodError for push_hour > 23', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validFilterData, push_hour: 24 })
    ).rejects.toThrow()
  })

  it('throws ZodError for difficulty > 3000', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validFilterData, difficulty_max: 3001 })
    ).rejects.toThrow()
  })

  it('throws ZodError for difficulty < 0', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validFilterData, difficulty_min: -1 })
    ).rejects.toThrow()
  })

  // ─── Error handling ───

  it('throws when profile fetch fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(completeOnboarding(validFilterData)).rejects.toThrow('無法載入使用者資料')
  })

  it('throws when updateUser fails', async () => {
    vi.mocked(updateUser).mockRejectedValue(new Error('update failed'))

    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(completeOnboarding(validFilterData)).rejects.toThrow('新手引導完成失敗')
  })

  it('throws when upsertListProgress fails', async () => {
    vi.mocked(upsertListProgress).mockRejectedValue(new Error('upsert failed'))

    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(completeOnboarding(validListData)).rejects.toThrow('新手引導完成失敗')
  })

  // ─── Security ───

  it('throws when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockRejectedValue(new Error('Unauthenticated'))

    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(completeOnboarding(validFilterData)).rejects.toThrow('Unauthenticated')
  })

  // ─── Edge cases ───

  it('calls toUtcHour with correct timezone argument', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(completeOnboarding(validFilterData)).rejects.toThrow('NEXT_REDIRECT')

    expect(toUtcHour).toHaveBeenCalledWith(9, 'Asia/Taipei')
  })

  it('accepts push_hour=0 boundary value', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validFilterData, push_hour: 0 })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(updateUser).toHaveBeenCalledWith(
      mockSupabase,
      'user-123',
      expect.objectContaining({ push_hour: 0 })
    )
  })

  it('accepts push_hour=23 boundary value', async () => {
    const { completeOnboarding } = await import('@/lib/actions/onboarding')
    await expect(
      completeOnboarding({ ...validFilterData, push_hour: 23 })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(updateUser).toHaveBeenCalledWith(
      mockSupabase,
      'user-123',
      expect.objectContaining({ push_hour: 23 })
    )
  })
})
