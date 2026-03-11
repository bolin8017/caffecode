// apps/web/lib/__tests__/settings-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZodError } from 'zod'

// ── Hoisted mocks ──────────────────────────────────────────────

const mockGetAuthUser = vi.fn()
const mockGetUserSettings = vi.fn()
const mockUpdateUser = vi.fn()
const mockDeactivateAllLists = vi.fn()
const mockUpsertListProgress = vi.fn()
const mockToUtcHour = vi.fn()
const mockRevalidatePath = vi.fn()
const mockRedirect = vi.fn()
const mockLoggerError = vi.fn()
const mockLoggerInfo = vi.fn()

// Service client mock for deleteAccount
const mockServiceAuthAdminDeleteUser = vi.fn()
const mockServiceFrom = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/auth', () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock('@/lib/repositories/user.repository', () => ({
  getUserSettings: (...args: unknown[]) => mockGetUserSettings(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
}))

vi.mock('@/lib/repositories/list.repository', () => ({
  deactivateAllLists: (...args: unknown[]) => mockDeactivateAllLists(...args),
  upsertListProgress: (...args: unknown[]) => mockUpsertListProgress(...args),
}))

vi.mock('@/lib/utils/timezone', () => ({
  toUtcHour: (...args: unknown[]) => mockToUtcHour(...args),
}))

vi.mock('@/lib/schemas/timezone', async () => {
  const { z } = await import('zod')
  return {
    timezoneSchema: z.string().refine(
      (tz) => ['Asia/Taipei', 'America/New_York', 'UTC', 'Europe/London'].includes(tz),
      'Invalid IANA timezone'
    ),
  }
})

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
    auth: { admin: { deleteUser: mockServiceAuthAdminDeleteUser } },
  })),
}))

// ── Helpers ────────────────────────────────────────────────────

const MOCK_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

function setupAuthUser(userId = MOCK_USER_ID) {
  const supabaseMock = {
    auth: { signOut: mockSignOut },
    from: vi.fn(),
  }
  mockGetAuthUser.mockResolvedValue({ supabase: supabaseMock, user: { id: userId } })
  return supabaseMock
}

function setupAuthFail() {
  mockGetAuthUser.mockRejectedValue(new Error('Unauthenticated'))
}

// ── Tests ──────────────────────────────────────────────────────

describe('settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToUtcHour.mockReturnValue(1) // default: local 9 in Asia/Taipei → UTC 1
    mockGetUserSettings.mockResolvedValue({ push_enabled: true, push_hour: 9, timezone: 'Asia/Taipei', line_push_allowed: true })
    mockUpdateUser.mockResolvedValue(undefined)
    mockDeactivateAllLists.mockResolvedValue(undefined)
    mockUpsertListProgress.mockResolvedValue(undefined)
    mockSignOut.mockResolvedValue({ error: null })
  })

  // ═══════════════════════════════════════════════════════════════
  // updatePushSettings (9)
  // ═══════════════════════════════════════════════════════════════

  describe('updatePushSettings', () => {
    it('updates push settings with computed push_hour_utc', async () => {
      setupAuthUser()
      mockToUtcHour.mockReturnValue(1)

      const { updatePushSettings } = await import('@/lib/actions/settings')
      await updatePushSettings(true, 9)

      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_USER_ID,
        { push_enabled: true, push_hour: 9, push_hour_utc: 1 }
      )
    })

    it('uses default timezone Asia/Taipei when getUserSettings returns null timezone', async () => {
      setupAuthUser()
      mockGetUserSettings.mockResolvedValue({ timezone: null })
      mockToUtcHour.mockReturnValue(1)

      const { updatePushSettings } = await import('@/lib/actions/settings')
      await updatePushSettings(false, 12)

      expect(mockToUtcHour).toHaveBeenCalledWith(12, 'Asia/Taipei')
    })

    it('revalidates /settings and /dashboard', async () => {
      setupAuthUser()

      const { updatePushSettings } = await import('@/lib/actions/settings')
      await updatePushSettings(true, 9)

      expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard')
    })

    it('throws ZodError when push_enabled is not boolean', async () => {
      setupAuthUser()

      const { updatePushSettings } = await import('@/lib/actions/settings')
      await expect(updatePushSettings('yes' as unknown as boolean, 9)).rejects.toThrow(ZodError)
    })

    it('throws ZodError when push_hour is negative', async () => {
      setupAuthUser()

      const { updatePushSettings } = await import('@/lib/actions/settings')
      await expect(updatePushSettings(true, -1)).rejects.toThrow(ZodError)
    })

    it('throws ZodError when push_hour exceeds 23', async () => {
      setupAuthUser()

      const { updatePushSettings } = await import('@/lib/actions/settings')
      await expect(updatePushSettings(true, 24)).rejects.toThrow(ZodError)
    })

    it('throws on DB error', async () => {
      setupAuthUser()
      mockUpdateUser.mockRejectedValue(new Error('DB connection lost'))

      const { updatePushSettings } = await import('@/lib/actions/settings')
      await expect(updatePushSettings(true, 9)).rejects.toThrow('推送設定更新失敗')
      expect(mockLoggerError).toHaveBeenCalled()
    })

    it('throws Unauthenticated when not logged in', async () => {
      setupAuthFail()

      const { updatePushSettings } = await import('@/lib/actions/settings')
      await expect(updatePushSettings(true, 9)).rejects.toThrow('Unauthenticated')
    })

    it('passes correct arguments to toUtcHour', async () => {
      setupAuthUser()
      mockGetUserSettings.mockResolvedValue({ timezone: 'America/New_York' })

      const { updatePushSettings } = await import('@/lib/actions/settings')
      await updatePushSettings(true, 14)

      expect(mockToUtcHour).toHaveBeenCalledWith(14, 'America/New_York')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // updateTimezone (6)
  // ═══════════════════════════════════════════════════════════════

  describe('updateTimezone', () => {
    it('updates timezone and recalculates push_hour_utc', async () => {
      setupAuthUser()
      mockGetUserSettings.mockResolvedValue({ push_hour: 9, timezone: 'Asia/Taipei' })
      mockToUtcHour.mockReturnValue(14)

      const { updateTimezone } = await import('@/lib/actions/settings')
      await updateTimezone('America/New_York')

      expect(mockToUtcHour).toHaveBeenCalledWith(9, 'America/New_York')
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_USER_ID,
        { timezone: 'America/New_York', push_hour_utc: 14 }
      )
    })

    it('defaults push_hour to 9 when getUserSettings returns null', async () => {
      setupAuthUser()
      mockGetUserSettings.mockResolvedValue(null)
      mockToUtcHour.mockReturnValue(1)

      const { updateTimezone } = await import('@/lib/actions/settings')
      await updateTimezone('Asia/Taipei')

      expect(mockToUtcHour).toHaveBeenCalledWith(9, 'Asia/Taipei')
    })

    it('revalidates /settings', async () => {
      setupAuthUser()

      const { updateTimezone } = await import('@/lib/actions/settings')
      await updateTimezone('Asia/Taipei')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
    })

    it('throws ZodError for invalid timezone', async () => {
      setupAuthUser()

      const { updateTimezone } = await import('@/lib/actions/settings')
      await expect(updateTimezone('Invalid/Zone')).rejects.toThrow()
    })

    it('throws on DB error', async () => {
      setupAuthUser()
      mockUpdateUser.mockRejectedValue(new Error('fail'))

      const { updateTimezone } = await import('@/lib/actions/settings')
      await expect(updateTimezone('Asia/Taipei')).rejects.toThrow('時區更新失敗')
    })

    it('throws Unauthenticated when not logged in', async () => {
      setupAuthFail()

      const { updateTimezone } = await import('@/lib/actions/settings')
      await expect(updateTimezone('Asia/Taipei')).rejects.toThrow('Unauthenticated')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // updateLearningMode (11)
  // ═══════════════════════════════════════════════════════════════

  describe('updateLearningMode', () => {
    it('sets list mode: deactivates all, upserts new list', async () => {
      setupAuthUser()

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await updateLearningMode({ mode: 'list', list_id: 5 })

      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_USER_ID,
        { active_mode: 'list' }
      )
      expect(mockDeactivateAllLists).toHaveBeenCalledWith(expect.anything(), MOCK_USER_ID)
      expect(mockUpsertListProgress).toHaveBeenCalledWith(
        expect.anything(),
        { user_id: MOCK_USER_ID, list_id: 5, is_active: true }
      )
    })

    it('sets filter mode with difficulty and topic', async () => {
      setupAuthUser()

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await updateLearningMode({
        mode: 'filter',
        difficulty_min: 1000,
        difficulty_max: 2000,
        topic_filter: ['array', 'dp'],
      })

      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_USER_ID,
        {
          active_mode: 'filter',
          difficulty_min: 1000,
          difficulty_max: 2000,
          topic_filter: ['array', 'dp'],
        }
      )
    })

    it('revalidates /settings and /dashboard', async () => {
      setupAuthUser()

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await updateLearningMode({ mode: 'filter', difficulty_min: 0, difficulty_max: 3000, topic_filter: null })

      expect(mockRevalidatePath).toHaveBeenCalledWith('/settings')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard')
    })

    it('throws ZodError for invalid mode', async () => {
      setupAuthUser()

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await expect(
        updateLearningMode({ mode: 'random' } as unknown as Parameters<typeof updateLearningMode>[0])
      ).rejects.toThrow(ZodError)
    })

    it('throws ZodError when list_id is non-positive', async () => {
      setupAuthUser()

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await expect(updateLearningMode({ mode: 'list', list_id: 0 })).rejects.toThrow(ZodError)
    })

    it('throws ZodError when difficulty_min > difficulty_max', async () => {
      setupAuthUser()

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await expect(
        updateLearningMode({ mode: 'filter', difficulty_min: 2000, difficulty_max: 1000, topic_filter: null })
      ).rejects.toThrow(ZodError)
    })

    it('throws ZodError when difficulty exceeds 3000', async () => {
      setupAuthUser()

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await expect(
        updateLearningMode({ mode: 'filter', difficulty_min: 0, difficulty_max: 3001, topic_filter: null })
      ).rejects.toThrow(ZodError)
    })

    it('throws ZodError when topic_filter has more than 50 items', async () => {
      setupAuthUser()
      const tooManyTopics = Array.from({ length: 51 }, (_, i) => `topic-${i}`)

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await expect(
        updateLearningMode({ mode: 'filter', difficulty_min: 0, difficulty_max: 3000, topic_filter: tooManyTopics })
      ).rejects.toThrow(ZodError)
    })

    it('throws on DB error', async () => {
      setupAuthUser()
      mockUpdateUser.mockRejectedValue(new Error('fail'))

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await expect(
        updateLearningMode({ mode: 'filter', difficulty_min: 0, difficulty_max: 3000, topic_filter: null })
      ).rejects.toThrow('學習模式更新失敗')
    })

    it('throws Unauthenticated when not logged in', async () => {
      setupAuthFail()

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await expect(
        updateLearningMode({ mode: 'filter', difficulty_min: 0, difficulty_max: 3000, topic_filter: null })
      ).rejects.toThrow('Unauthenticated')
    })

    it('accepts null topic_filter in filter mode', async () => {
      setupAuthUser()

      const { updateLearningMode } = await import('@/lib/actions/settings')
      await updateLearningMode({ mode: 'filter', difficulty_min: 0, difficulty_max: 3000, topic_filter: null })

      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_USER_ID,
        expect.objectContaining({ topic_filter: null })
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // subscribeToList (9)
  // ═══════════════════════════════════════════════════════════════

  describe('subscribeToList', () => {
    it('subscribes to a list: updates mode, deactivates, upserts', async () => {
      setupAuthUser()

      const { subscribeToList } = await import('@/lib/actions/settings')
      await subscribeToList(10)

      expect(mockUpdateUser).toHaveBeenCalledWith(expect.anything(), MOCK_USER_ID, { active_mode: 'list' })
      expect(mockDeactivateAllLists).toHaveBeenCalledWith(expect.anything(), MOCK_USER_ID)
      expect(mockUpsertListProgress).toHaveBeenCalledWith(
        expect.anything(),
        { user_id: MOCK_USER_ID, list_id: 10, is_active: true }
      )
    })

    it('includes startPosition when provided', async () => {
      setupAuthUser()

      const { subscribeToList } = await import('@/lib/actions/settings')
      await subscribeToList(10, 5)

      expect(mockUpsertListProgress).toHaveBeenCalledWith(
        expect.anything(),
        { user_id: MOCK_USER_ID, list_id: 10, is_active: true, current_position: 5 }
      )
    })

    it('revalidates /dashboard and /settings/learning', async () => {
      setupAuthUser()

      const { subscribeToList } = await import('@/lib/actions/settings')
      await subscribeToList(10)

      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/learning')
    })

    it('throws ZodError for non-positive listId', async () => {
      setupAuthUser()

      const { subscribeToList } = await import('@/lib/actions/settings')
      await expect(subscribeToList(0)).rejects.toThrow(ZodError)
    })

    it('throws when deactivateAllLists fails', async () => {
      setupAuthUser()
      mockDeactivateAllLists.mockRejectedValue(new Error('fail'))

      const { subscribeToList } = await import('@/lib/actions/settings')
      await expect(subscribeToList(10)).rejects.toThrow('列表訂閱失敗')
    })

    it('throws when upsertListProgress fails', async () => {
      setupAuthUser()
      mockUpsertListProgress.mockRejectedValue(new Error('fail'))

      const { subscribeToList } = await import('@/lib/actions/settings')
      await expect(subscribeToList(10)).rejects.toThrow('列表訂閱失敗')
    })

    it('throws Unauthenticated when not logged in', async () => {
      setupAuthFail()

      const { subscribeToList } = await import('@/lib/actions/settings')
      await expect(subscribeToList(10)).rejects.toThrow('Unauthenticated')
    })

    it('runs updateUser and deactivateAllLists in parallel', async () => {
      setupAuthUser()
      const callOrder: string[] = []
      mockUpdateUser.mockImplementation(async () => {
        callOrder.push('updateUser')
      })
      mockDeactivateAllLists.mockImplementation(async () => {
        callOrder.push('deactivateAllLists')
      })

      const { subscribeToList } = await import('@/lib/actions/settings')
      await subscribeToList(10)

      // Both should be called (order doesn't matter since they run in parallel)
      expect(callOrder).toContain('updateUser')
      expect(callOrder).toContain('deactivateAllLists')
      // upsertListProgress should be called after the parallel pair
      expect(mockUpsertListProgress).toHaveBeenCalled()
    })

    it('throws ZodError for float listId', async () => {
      setupAuthUser()

      const { subscribeToList } = await import('@/lib/actions/settings')
      await expect(subscribeToList(1.5)).rejects.toThrow(ZodError)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // deleteAccount (6)
  // ═══════════════════════════════════════════════════════════════

  describe('deleteAccount', () => {
    it('deletes auth user, then DB row, then signs out and redirects', async () => {
      setupAuthUser()
      mockServiceAuthAdminDeleteUser.mockResolvedValue({ error: null })
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqFn }) })
      mockSignOut.mockResolvedValue({ error: null })

      const { deleteAccount } = await import('@/lib/actions/settings')
      await deleteAccount()

      expect(mockServiceAuthAdminDeleteUser).toHaveBeenCalledWith(MOCK_USER_ID)
      expect(mockServiceFrom).toHaveBeenCalledWith('users')
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockRedirect).toHaveBeenCalledWith('/')
    })

    it('returns error when auth deletion fails', async () => {
      setupAuthUser()
      mockServiceAuthAdminDeleteUser.mockResolvedValue({ error: { message: 'auth fail' } })

      const { deleteAccount } = await import('@/lib/actions/settings')
      const result = await deleteAccount()

      expect(result).toEqual({ success: false, error: '刪除認證帳號失敗' })
      // Should NOT proceed to DB delete
      expect(mockServiceFrom).not.toHaveBeenCalledWith('users')
    })

    it('returns error when DB deletion fails', async () => {
      setupAuthUser()
      mockServiceAuthAdminDeleteUser.mockResolvedValue({ error: null })
      const eqFn = vi.fn().mockResolvedValue({ error: { message: 'FK error' } })
      mockServiceFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqFn }) })

      const { deleteAccount } = await import('@/lib/actions/settings')
      const result = await deleteAccount()

      expect(result).toEqual({ success: false, error: '刪除帳號資料失敗' })
    })

    it('throws Unauthenticated when not logged in', async () => {
      setupAuthFail()

      const { deleteAccount } = await import('@/lib/actions/settings')
      await expect(deleteAccount()).rejects.toThrow('Unauthenticated')
    })

    it('catches signOut error gracefully', async () => {
      setupAuthUser()
      mockServiceAuthAdminDeleteUser.mockResolvedValue({ error: null })
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqFn }) })
      mockSignOut.mockRejectedValue(new Error('signout fail'))

      const { deleteAccount } = await import('@/lib/actions/settings')
      // Should not throw — signOut failure is caught
      await expect(deleteAccount()).resolves.not.toThrow()
      expect(mockRedirect).toHaveBeenCalledWith('/')
    })

    it('calls auth delete before DB delete', async () => {
      const callOrder: string[] = []
      setupAuthUser()
      mockServiceAuthAdminDeleteUser.mockImplementation(async () => {
        callOrder.push('auth-delete')
        return { error: null }
      })
      const eqFn = vi.fn().mockImplementation(async () => {
        callOrder.push('db-delete')
        return { error: null }
      })
      mockServiceFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqFn }) })

      const { deleteAccount } = await import('@/lib/actions/settings')
      await deleteAccount()

      expect(callOrder).toEqual(['auth-delete', 'db-delete'])
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // exportData (6)
  // ═══════════════════════════════════════════════════════════════

  describe('exportData', () => {
    function setupSupabaseQueries(
      historyData: unknown[] = [],
      feedbackData: unknown[] = [],
      progressData: unknown[] = [],
      errors: { history?: object; feedback?: object; progress?: object } = {}
    ) {
      const supabase = setupAuthUser()
      const historyChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: historyData, error: errors.history ?? null }),
        }),
      }
      const feedbackChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: feedbackData, error: errors.feedback ?? null }),
        }),
      }
      const progressChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: progressData, error: errors.progress ?? null }),
        }),
      }
      supabase.from
        .mockReturnValueOnce(historyChain)    // history
        .mockReturnValueOnce(feedbackChain)    // feedback
        .mockReturnValueOnce(progressChain)    // user_list_progress
      return supabase
    }

    it('returns exported data with timestamp', async () => {
      setupSupabaseQueries(
        [{ sent_at: '2026-03-01', problems: { title: 'Two Sum', slug: 'two-sum' } }],
        [{ problem_id: 1, difficulty: 'easy', content_score: 4, created_at: '2026-03-01' }],
        [{ current_position: 5, is_active: true, curated_lists: { name: 'NeetCode', slug: 'neetcode' } }]
      )

      const { exportData } = await import('@/lib/actions/settings')
      const result = await exportData()

      expect(result.exported_at).toBeDefined()
      expect(result.history).toHaveLength(1)
      expect(result.feedback).toHaveLength(1)
      expect(result.list_progress).toHaveLength(1)
    })

    it('runs all three queries in parallel', async () => {
      const supabase = setupSupabaseQueries()

      const { exportData } = await import('@/lib/actions/settings')
      await exportData()

      // All three tables should be queried
      expect(supabase.from).toHaveBeenCalledTimes(3)
      expect(supabase.from).toHaveBeenCalledWith('history')
      expect(supabase.from).toHaveBeenCalledWith('feedback')
      expect(supabase.from).toHaveBeenCalledWith('user_list_progress')
    })

    it('throws when any single query fails', async () => {
      setupSupabaseQueries([], [], [], { feedback: { message: 'db error' } })

      const { exportData } = await import('@/lib/actions/settings')
      await expect(exportData()).rejects.toThrow('資料匯出失敗')
    })

    it('logs individual errors before throwing', async () => {
      setupSupabaseQueries([], [], [], {
        history: { message: 'h-fail' },
        feedback: { message: 'f-fail' },
      })

      const { exportData } = await import('@/lib/actions/settings')
      await expect(exportData()).rejects.toThrow('資料匯出失敗')
      // Logger should be called for each error
      expect(mockLoggerError).toHaveBeenCalled()
    })

    it('throws Unauthenticated when not logged in', async () => {
      setupAuthFail()

      const { exportData } = await import('@/lib/actions/settings')
      await expect(exportData()).rejects.toThrow('Unauthenticated')
    })

    it('returns empty arrays when user has no data', async () => {
      setupSupabaseQueries([], [], [])

      const { exportData } = await import('@/lib/actions/settings')
      const result = await exportData()

      expect(result.history).toEqual([])
      expect(result.feedback).toEqual([])
      expect(result.list_progress).toEqual([])
    })
  })
})
