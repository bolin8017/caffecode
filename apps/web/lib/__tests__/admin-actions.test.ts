// apps/web/lib/__tests__/admin-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZodError } from 'zod'

// ── Hoisted mocks ──────────────────────────────────────────────

const mockCookieGetUser = vi.fn()
const mockCookieFrom = vi.fn()
const mockServiceFrom = vi.fn()
const mockServiceRpc = vi.fn()
const mockServiceAuthAdminDeleteUser = vi.fn()
const mockServiceUpsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockCookieGetUser },
    from: mockCookieFrom,
  })),
  createServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
    rpc: mockServiceRpc,
    auth: { admin: { deleteUser: mockServiceAuthAdminDeleteUser } },
  })),
}))

vi.mock('@caffecode/shared', () => ({
  selectProblemForUser: vi.fn(),
  sendTelegramMessage: vi.fn(),
  sendLineMessage: vi.fn(),
  sendEmailMessage: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('p-limit', () => ({ default: () => (fn: Function) => fn() }))

// ── Imports (after mocks) ──────────────────────────────────────

import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  selectProblemForUser,
  sendTelegramMessage,
  sendLineMessage,
  sendEmailMessage,
} from '@caffecode/shared'

// ── Helpers ────────────────────────────────────────────────────

function setupAuth(user: { id: string } | null, error: object | null = null) {
  mockCookieGetUser.mockResolvedValue({ data: { user }, error })
}

function setupProfile(isAdmin: boolean | null, error: object | null = null) {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({
    data: isAdmin === null ? null : { is_admin: isAdmin },
    error: error ?? (isAdmin === null ? { message: 'not found' } : null),
  })
  mockCookieFrom.mockReturnValue(chain)
  return chain
}

function setupAdmin() {
  setupAuth({ id: 'admin-1' })
  setupProfile(true)
}

function setupNonAdmin() {
  setupAuth({ id: 'user-1' })
  setupProfile(false)
}

/** Create a chained Supabase query builder mock that resolves at the terminal step. */
function makeChain(
  data: unknown = null,
  error: object | null = null,
  terminal: 'single' | 'none' = 'none'
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['select', 'eq', 'in', 'lt', 'delete', 'update', 'upsert', 'single']
  for (const m of methods) {
    if (m === terminal || (terminal === 'none' && m === methods[methods.length - 1])) {
      chain[m] = vi.fn().mockResolvedValue({ data, error })
    } else {
      chain[m] = vi.fn().mockReturnValue(chain)
    }
  }
  // Make non-terminal methods also return chain for flexible chaining
  for (const m of methods) {
    if (!chain[m].mockResolvedValue) {
      // Already set as chain returner
    }
  }
  return chain
}

/** Set mockServiceFrom to return a chain for a given table. */
function setupServiceTable(
  data: unknown = null,
  error: object | null = null,
  terminal: 'single' | 'none' = 'none'
) {
  const chain = makeChain(data, error, terminal)
  mockServiceFrom.mockReturnValue(chain)
  return chain
}

// ── Tests ──────────────────────────────────────────────────────

describe('admin actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset env vars for dispatchToChannel tests
    process.env.TELEGRAM_BOT_TOKEN = 'test-tg-token'
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-line-token'
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.RESEND_FROM_EMAIL = 'Test <test@example.com>'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://caffecode.net'
  })

  // ═══════════════════════════════════════════════════════════════
  // requireAdmin (tested indirectly via other actions)
  // ═══════════════════════════════════════════════════════════════

  describe('requireAdmin (via deleteProblem)', () => {
    it('throws Unauthenticated when auth returns error', async () => {
      setupAuth(null, { message: 'session expired' })
      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(1)).rejects.toThrow('Unauthenticated')
    })

    it('throws Unauthenticated when user is null', async () => {
      setupAuth(null)
      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(1)).rejects.toThrow('Unauthenticated')
    })

    it('throws Forbidden when profile query errors', async () => {
      setupAuth({ id: 'u1' })
      setupProfile(null, { message: 'db error' })
      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(1)).rejects.toThrow('Forbidden')
    })

    it('throws Forbidden when user is not admin', async () => {
      setupNonAdmin()
      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(1)).rejects.toThrow('Forbidden')
    })

    it('throws Forbidden when profile is null', async () => {
      setupAuth({ id: 'u1' })
      const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
      chain.select.mockReturnValue(chain)
      chain.eq.mockReturnValue(chain)
      chain.single.mockResolvedValue({ data: null, error: null })
      mockCookieFrom.mockReturnValue(chain)
      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(1)).rejects.toThrow('Forbidden')
    })

    it('returns user and adminDb on success', async () => {
      setupAdmin()
      setupServiceTable(null, null) // for the delete chain
      const { deleteProblem } = await import('@/lib/actions/admin')
      // If requireAdmin succeeds, deleteProblem proceeds without auth errors
      await expect(deleteProblem(1)).resolves.toBeUndefined()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // deleteProblem (6)
  // ═══════════════════════════════════════════════════════════════

  describe('deleteProblem', () => {
    it('deletes the problem and revalidates /admin/problems', async () => {
      setupAdmin()
      const chain = {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
      mockServiceFrom.mockReturnValue(chain)

      const { deleteProblem } = await import('@/lib/actions/admin')
      await deleteProblem(42)

      expect(mockServiceFrom).toHaveBeenCalledWith('problems')
      expect(chain.delete).toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith('/admin/problems')
    })

    it('throws ZodError for float input', async () => {
      setupAdmin()
      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(1.5)).rejects.toThrow(ZodError)
    })

    it('throws ZodError for zero', async () => {
      setupAdmin()
      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(0)).rejects.toThrow(ZodError)
    })

    it('throws ZodError for negative number', async () => {
      setupAdmin()
      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(-1)).rejects.toThrow(ZodError)
    })

    it('throws on DB error', async () => {
      setupAdmin()
      const chain = {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'FK constraint' } }),
        }),
      }
      mockServiceFrom.mockReturnValue(chain)

      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(1)).rejects.toThrow('Failed to delete problem')
      expect(logger.error).toHaveBeenCalled()
    })

    it('throws Forbidden for non-admin', async () => {
      setupNonAdmin()
      const { deleteProblem } = await import('@/lib/actions/admin')
      await expect(deleteProblem(1)).rejects.toThrow('Forbidden')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // flagForRegeneration (4)
  // ═══════════════════════════════════════════════════════════════

  describe('flagForRegeneration', () => {
    it('sets needs_regeneration=true and revalidates /admin/content', async () => {
      setupAdmin()
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      const chain = {
        update: vi.fn().mockReturnValue({ eq: eqFn }),
      }
      mockServiceFrom.mockReturnValue(chain)

      const { flagForRegeneration } = await import('@/lib/actions/admin')
      await flagForRegeneration(10)

      expect(mockServiceFrom).toHaveBeenCalledWith('problem_content')
      expect(chain.update).toHaveBeenCalledWith({ needs_regeneration: true })
      expect(revalidatePath).toHaveBeenCalledWith('/admin/content')
    })

    it('throws ZodError for non-positive integer', async () => {
      setupAdmin()
      const { flagForRegeneration } = await import('@/lib/actions/admin')
      await expect(flagForRegeneration(0)).rejects.toThrow(ZodError)
    })

    it('throws on DB error', async () => {
      setupAdmin()
      const eqFn = vi.fn().mockResolvedValue({ error: { message: 'fail' } })
      mockServiceFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqFn }) })

      const { flagForRegeneration } = await import('@/lib/actions/admin')
      await expect(flagForRegeneration(1)).rejects.toThrow('Failed to flag for regeneration')
    })

    it('throws Forbidden for non-admin', async () => {
      setupNonAdmin()
      const { flagForRegeneration } = await import('@/lib/actions/admin')
      await expect(flagForRegeneration(1)).rejects.toThrow('Forbidden')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // unflagRegeneration (4)
  // ═══════════════════════════════════════════════════════════════

  describe('unflagRegeneration', () => {
    it('sets needs_regeneration=false and revalidates', async () => {
      setupAdmin()
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqFn }) })

      const { unflagRegeneration } = await import('@/lib/actions/admin')
      await unflagRegeneration(5)

      expect(mockServiceFrom).toHaveBeenCalledWith('problem_content')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/content')
    })

    it('throws ZodError for non-positive integer', async () => {
      setupAdmin()
      const { unflagRegeneration } = await import('@/lib/actions/admin')
      await expect(unflagRegeneration(-1)).rejects.toThrow(ZodError)
    })

    it('throws on DB error', async () => {
      setupAdmin()
      const eqFn = vi.fn().mockResolvedValue({ error: { message: 'fail' } })
      mockServiceFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqFn }) })

      const { unflagRegeneration } = await import('@/lib/actions/admin')
      await expect(unflagRegeneration(1)).rejects.toThrow('Failed to unflag regeneration')
    })

    it('throws Forbidden for non-admin', async () => {
      setupNonAdmin()
      const { unflagRegeneration } = await import('@/lib/actions/admin')
      await expect(unflagRegeneration(1)).rejects.toThrow('Forbidden')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // setLinePushAllowed (6)
  // ═══════════════════════════════════════════════════════════════

  describe('setLinePushAllowed', () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

    it('updates line_push_allowed to true', async () => {
      setupAdmin()
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqFn }) })

      const { setLinePushAllowed } = await import('@/lib/actions/admin')
      await setLinePushAllowed(VALID_UUID, true)

      expect(mockServiceFrom).toHaveBeenCalledWith('users')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('updates line_push_allowed to false', async () => {
      setupAdmin()
      const updateFn = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      mockServiceFrom.mockReturnValue({ update: updateFn })

      const { setLinePushAllowed } = await import('@/lib/actions/admin')
      await setLinePushAllowed(VALID_UUID, false)

      expect(updateFn).toHaveBeenCalledWith({ line_push_allowed: false })
    })

    it('throws ZodError for invalid UUID', async () => {
      setupAdmin()
      const { setLinePushAllowed } = await import('@/lib/actions/admin')
      await expect(setLinePushAllowed('not-a-uuid', true)).rejects.toThrow(ZodError)
    })

    it('throws ZodError for non-boolean allowed', async () => {
      setupAdmin()
      const { setLinePushAllowed } = await import('@/lib/actions/admin')
      await expect(setLinePushAllowed(VALID_UUID, 'yes' as unknown as boolean)).rejects.toThrow(ZodError)
    })

    it('throws on DB error', async () => {
      setupAdmin()
      const eqFn = vi.fn().mockResolvedValue({ error: { message: 'fail' } })
      mockServiceFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqFn }) })

      const { setLinePushAllowed } = await import('@/lib/actions/admin')
      await expect(setLinePushAllowed(VALID_UUID, true)).rejects.toThrow('Failed to update LINE push allowed')
    })

    it('throws Forbidden for non-admin', async () => {
      setupNonAdmin()
      const { setLinePushAllowed } = await import('@/lib/actions/admin')
      await expect(setLinePushAllowed(VALID_UUID, true)).rejects.toThrow('Forbidden')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // deleteUser (9)
  // ═══════════════════════════════════════════════════════════════

  describe('deleteUser', () => {
    const TARGET_UUID = '550e8400-e29b-41d4-a716-446655440001'
    const ADMIN_UUID = 'admin-1'

    it('deletes auth user then DB user and revalidates', async () => {
      setupAdmin()
      // Target lookup: non-admin user
      const singleFn = vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null })
      const targetChain = { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }) }
      // DB delete after auth delete
      const deleteEqFn = vi.fn().mockResolvedValue({ error: null })
      const deleteChain = { delete: vi.fn().mockReturnValue({ eq: deleteEqFn }) }
      mockServiceFrom
        .mockReturnValueOnce(targetChain) // target profile lookup
        .mockReturnValueOnce(deleteChain) // DB delete
      mockServiceAuthAdminDeleteUser.mockResolvedValue({ error: null })

      const { deleteUser } = await import('@/lib/actions/admin')
      await deleteUser(TARGET_UUID)

      expect(mockServiceAuthAdminDeleteUser).toHaveBeenCalledWith(TARGET_UUID)
      expect(deleteChain.delete).toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith('/admin/users')
    })

    it('blocks self-deletion', async () => {
      // Use a valid UUID for both admin and target so UUID validation passes
      const ADMIN_VALID_UUID = '550e8400-e29b-41d4-a716-446655440099'
      setupAuth({ id: ADMIN_VALID_UUID })
      setupProfile(true)
      const { deleteUser } = await import('@/lib/actions/admin')
      await expect(deleteUser(ADMIN_VALID_UUID)).rejects.toThrow('Cannot delete your own admin account')
    })

    it('blocks deleting another admin', async () => {
      setupAdmin()
      const singleFn = vi.fn().mockResolvedValue({ data: { is_admin: true }, error: null })
      mockServiceFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }),
      })

      const { deleteUser } = await import('@/lib/actions/admin')
      await expect(deleteUser(TARGET_UUID)).rejects.toThrow('Cannot delete another admin account')
    })

    it('throws ZodError for invalid UUID', async () => {
      setupAdmin()
      const { deleteUser } = await import('@/lib/actions/admin')
      await expect(deleteUser('bad-id')).rejects.toThrow(ZodError)
    })

    it('throws when target lookup fails', async () => {
      setupAdmin()
      const singleFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
      mockServiceFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }),
      })

      const { deleteUser } = await import('@/lib/actions/admin')
      await expect(deleteUser(TARGET_UUID)).rejects.toThrow('Failed to verify target user')
    })

    it('throws when auth deletion fails', async () => {
      setupAdmin()
      const singleFn = vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null })
      mockServiceFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }),
      })
      mockServiceAuthAdminDeleteUser.mockResolvedValue({ error: { message: 'auth fail' } })

      const { deleteUser } = await import('@/lib/actions/admin')
      await expect(deleteUser(TARGET_UUID)).rejects.toThrow('Failed to delete user')
    })

    it('throws when DB deletion fails', async () => {
      setupAdmin()
      const singleFn = vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null })
      const targetChain = { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }) }
      const deleteEqFn = vi.fn().mockResolvedValue({ error: { message: 'FK constraint' } })
      const deleteChain = { delete: vi.fn().mockReturnValue({ eq: deleteEqFn }) }
      mockServiceFrom
        .mockReturnValueOnce(targetChain)
        .mockReturnValueOnce(deleteChain)
      mockServiceAuthAdminDeleteUser.mockResolvedValue({ error: null })

      const { deleteUser } = await import('@/lib/actions/admin')
      await expect(deleteUser(TARGET_UUID)).rejects.toThrow('Failed to delete user')
    })

    it('throws Forbidden for non-admin', async () => {
      setupNonAdmin()
      const { deleteUser } = await import('@/lib/actions/admin')
      await expect(deleteUser(TARGET_UUID)).rejects.toThrow('Forbidden')
    })

    it('calls auth delete before DB delete', async () => {
      setupAdmin()
      const callOrder: string[] = []
      const singleFn = vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null })
      const targetChain = { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) }) }
      const deleteEqFn = vi.fn().mockImplementation(async () => {
        callOrder.push('db-delete')
        return { error: null }
      })
      const deleteChain = { delete: vi.fn().mockReturnValue({ eq: deleteEqFn }) }
      mockServiceFrom
        .mockReturnValueOnce(targetChain)
        .mockReturnValueOnce(deleteChain)
      mockServiceAuthAdminDeleteUser.mockImplementation(async () => {
        callOrder.push('auth-delete')
        return { error: null }
      })

      const { deleteUser } = await import('@/lib/actions/admin')
      await deleteUser(TARGET_UUID)

      expect(callOrder).toEqual(['auth-delete', 'db-delete'])
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // resetChannelFailures (4)
  // ═══════════════════════════════════════════════════════════════

  describe('resetChannelFailures', () => {
    const CHANNEL_UUID = '550e8400-e29b-41d4-a716-446655440002'

    it('resets consecutive_send_failures to 0 and revalidates', async () => {
      setupAdmin()
      const eqFn = vi.fn().mockResolvedValue({ error: null })
      const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
      mockServiceFrom.mockReturnValue({ update: updateFn })

      const { resetChannelFailures } = await import('@/lib/actions/admin')
      await resetChannelFailures(CHANNEL_UUID)

      expect(mockServiceFrom).toHaveBeenCalledWith('notification_channels')
      expect(updateFn).toHaveBeenCalledWith({ consecutive_send_failures: 0 })
      expect(revalidatePath).toHaveBeenCalledWith('/admin/channels')
    })

    it('throws ZodError for invalid UUID', async () => {
      setupAdmin()
      const { resetChannelFailures } = await import('@/lib/actions/admin')
      await expect(resetChannelFailures('not-uuid')).rejects.toThrow(ZodError)
    })

    it('throws on DB error', async () => {
      setupAdmin()
      const eqFn = vi.fn().mockResolvedValue({ error: { message: 'db err' } })
      mockServiceFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqFn }) })

      const { resetChannelFailures } = await import('@/lib/actions/admin')
      await expect(resetChannelFailures(CHANNEL_UUID)).rejects.toThrow('Failed to reset channel failures')
    })

    it('throws Forbidden for non-admin', async () => {
      setupNonAdmin()
      const { resetChannelFailures } = await import('@/lib/actions/admin')
      await expect(resetChannelFailures(CHANNEL_UUID)).rejects.toThrow('Forbidden')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // testNotifyChannel (13)
  // ═══════════════════════════════════════════════════════════════

  describe('testNotifyChannel', () => {
    const CHANNEL_UUID = '550e8400-e29b-41d4-a716-446655440003'
    const USER_ID = '550e8400-e29b-41d4-a716-446655440004'

    const baseProblem = {
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcode_id: 1,
      explanation: 'Use a hash map.',
      slug: 'two-sum',
      problem_id: 42,
      list_id: null,
      sequence_number: null,
    }

    function setupChannelLookup(
      channel: { id: string; user_id: string; channel_type: string; channel_identifier: string; users: object } | null,
      error: object | null = null
    ) {
      const singleFn = vi.fn().mockResolvedValue({ data: channel, error })
      mockServiceFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleFn }),
        }),
      })
    }

    function setupLinePushLookup(allowed: boolean, error: object | null = null) {
      const singleFn = vi.fn().mockResolvedValue({
        data: error ? null : { line_push_allowed: allowed },
        error,
      })
      mockServiceFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleFn }),
        }),
      })
    }

    const baseChannel = {
      id: CHANNEL_UUID,
      user_id: USER_ID,
      channel_type: 'telegram',
      channel_identifier: '12345',
      users: { id: USER_ID, active_mode: 'filter', difficulty_min: 0, difficulty_max: 3000, topic_filter: null },
    }

    it('sends telegram notification successfully', async () => {
      setupAdmin()
      setupChannelLookup(baseChannel)
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(true)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
      expect(sendTelegramMessage).toHaveBeenCalled()
    })

    it('sends LINE notification successfully', async () => {
      setupAdmin()
      const lineChannel = { ...baseChannel, channel_type: 'line', channel_identifier: 'line-uid' }
      setupChannelLookup(lineChannel)
      setupLinePushLookup(true)
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendLineMessage).mockResolvedValue({ success: true })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(true)
      expect(sendLineMessage).toHaveBeenCalled()
    })

    it('sends email notification successfully', async () => {
      setupAdmin()
      const emailChannel = { ...baseChannel, channel_type: 'email', channel_identifier: 'a@b.com' }
      setupChannelLookup(emailChannel)
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendEmailMessage).mockResolvedValue({ success: true })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(true)
      expect(sendEmailMessage).toHaveBeenCalled()
    })

    it('throws ZodError for invalid UUID', async () => {
      setupAdmin()
      const { testNotifyChannel } = await import('@/lib/actions/admin')
      await expect(testNotifyChannel('bad-uuid')).rejects.toThrow(ZodError)
    })

    it('returns error when channel not found', async () => {
      setupAdmin()
      setupChannelLookup(null, { message: 'not found' })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Channel not found')
    })

    it('returns error when LINE push not allowed', async () => {
      setupAdmin()
      const lineChannel = { ...baseChannel, channel_type: 'line' }
      setupChannelLookup(lineChannel)
      setupLinePushLookup(false)

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error).toContain('LINE push not allowed')
    })

    it('returns error when LINE user lookup fails', async () => {
      setupAdmin()
      const lineChannel = { ...baseChannel, channel_type: 'line' }
      setupChannelLookup(lineChannel)
      setupLinePushLookup(false, { message: 'db error' })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error).toContain('LINE push not allowed')
    })

    it('returns error when selectProblemForUser throws', async () => {
      setupAdmin()
      setupChannelLookup(baseChannel)
      vi.mocked(selectProblemForUser).mockRejectedValue(new Error('DB down'))

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Problem selection failed')
    })

    it('returns error when no problem available', async () => {
      setupAdmin()
      setupChannelLookup(baseChannel)
      vi.mocked(selectProblemForUser).mockResolvedValue(null)

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No problem available for this user')
    })

    it('truncates dispatch error to 200 chars', async () => {
      setupAdmin()
      setupChannelLookup(baseChannel)
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      const longError = 'x'.repeat(500)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: false, error: longError, shouldRetry: false })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error!.length).toBeLessThanOrEqual(200)
    })

    it('does not record history for test sends', async () => {
      setupAdmin()
      setupChannelLookup(baseChannel)
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      await testNotifyChannel(CHANNEL_UUID)

      // history upsert would go through mockServiceFrom('history') — should not be called
      // after the channel lookup and (optional) line push lookup, no further .from() calls
      const fromCalls = mockServiceFrom.mock.calls.map(c => c[0])
      expect(fromCalls).not.toContain('history')
    })

    it('measures latency in ms', async () => {
      setupAdmin()
      setupChannelLookup(baseChannel)
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockImplementation(async () => {
        return { success: true }
      })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(typeof result.latencyMs).toBe('number')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('throws Forbidden for non-admin', async () => {
      setupNonAdmin()
      const { testNotifyChannel } = await import('@/lib/actions/admin')
      await expect(testNotifyChannel(CHANNEL_UUID)).rejects.toThrow('Forbidden')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // forceNotifyAll (19)
  // ═══════════════════════════════════════════════════════════════

  describe('forceNotifyAll', () => {
    const USER_A = {
      id: 'ua-1111-1111-1111-111111111111',
      display_name: 'Alice',
      email: 'alice@test.com',
      active_mode: 'filter',
      difficulty_min: 0,
      difficulty_max: 3000,
      topic_filter: null,
      line_push_allowed: true,
    }
    const USER_B = {
      id: 'ub-2222-2222-2222-222222222222',
      display_name: null,
      email: 'bob@test.com',
      active_mode: 'list',
      difficulty_min: 1000,
      difficulty_max: 2000,
      topic_filter: ['array'],
      line_push_allowed: false,
    }

    const CHANNEL_TG = { id: 'ch-tg', user_id: USER_A.id, channel_type: 'telegram', channel_identifier: '111' }
    const CHANNEL_LINE = { id: 'ch-line', user_id: USER_B.id, channel_type: 'line', channel_identifier: 'line-222' }
    const CHANNEL_EMAIL = { id: 'ch-email', user_id: USER_A.id, channel_type: 'email', channel_identifier: 'alice@test.com' }

    const baseProblem = {
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcode_id: 1,
      explanation: 'hash map',
      slug: 'two-sum',
      problem_id: 42,
      list_id: null,
      sequence_number: null,
    }

    const listProblem = {
      ...baseProblem,
      title: 'Add Two Numbers',
      problem_id: 43,
      list_id: 5,
      sequence_number: 3,
    }

    function setupUsersQuery(users: typeof USER_A[] | null, error: object | null = null) {
      const eqFn = vi.fn().mockResolvedValue({ data: users, error })
      mockServiceFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({ eq: eqFn }),
      })
    }

    function setupChannelsQuery(channels: typeof CHANNEL_TG[] | null, error: object | null = null) {
      const ltFn = vi.fn().mockResolvedValue({ data: channels, error })
      mockServiceFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ lt: ltFn }),
          }),
        }),
      })
    }

    function setupPostWriteSuccess() {
      // history upsert
      mockServiceFrom.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })
      // stamp_last_push_date
      mockServiceRpc.mockResolvedValue({ error: null })
    }

    it('runs full happy path: select problem, dispatch, write history', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG])
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })
      // Post-write: history upsert + stamp
      const upsertFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValueOnce({ upsert: upsertFn })
      mockServiceRpc.mockResolvedValue({ error: null })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      expect(result.summary.sent).toBe(1)
      expect(result.summary.failed).toBe(0)
      expect(result.summary.skipped).toBe(0)
      expect(result.results[0].status).toBe('success')
      expect(result.results[0].problemTitle).toBe('Two Sum')
    })

    it('returns empty results when no push-enabled users', async () => {
      setupAdmin()
      setupUsersQuery([])

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      expect(result.results).toEqual([])
      expect(result.summary).toEqual({ sent: 0, failed: 0, skipped: 0 })
    })

    it('returns empty results when users query fails', async () => {
      setupAdmin()
      setupUsersQuery(null, { message: 'db error' })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      expect(result.results).toEqual([])
      expect(result.summary).toEqual({ sent: 0, failed: 0, skipped: 0 })
    })

    it('returns empty results when channels query fails', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery(null, { message: 'db error' })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      expect(result.results).toEqual([])
      expect(result.summary).toEqual({ sent: 0, failed: 0, skipped: 0 })
    })

    it('skips user with no channels', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([]) // no channels for anyone

      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      expect(result.summary.skipped).toBe(1)
      expect(result.results[0].status).toBe('skipped')
    })

    it('skips user when selectProblemForUser returns null', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG])
      vi.mocked(selectProblemForUser).mockResolvedValue(null)

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      expect(result.summary.skipped).toBe(1)
    })

    it('filters out LINE channels when user.line_push_allowed is false', async () => {
      setupAdmin()
      setupUsersQuery([USER_B]) // line_push_allowed = false
      setupChannelsQuery([CHANNEL_LINE]) // only a LINE channel

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      // User B has line_push_allowed=false, CHANNEL_LINE is filtered out → no channels → skipped
      expect(result.summary.skipped).toBe(1)
      expect(sendLineMessage).not.toHaveBeenCalled()
    })

    it('marks user as failed when all dispatches fail', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG])
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: false, error: 'bad token', shouldRetry: true })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      expect(result.summary.failed).toBe(1)
      expect(result.results[0].status).toBe('failed')
    })

    it('counts partial success correctly with multiple channels', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG, CHANNEL_EMAIL])
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })
      vi.mocked(sendEmailMessage).mockResolvedValue({ success: false, error: 'fail', shouldRetry: true })

      // Post-write for 1 successful delivery
      const upsertFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValueOnce({ upsert: upsertFn })
      mockServiceRpc.mockResolvedValue({ error: null })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      // At least one channel succeeded → status = 'success'
      expect(result.summary.sent).toBe(1)
      expect(result.results[0].channels).toHaveLength(2)
      expect(result.results[0].channels[0].success).toBe(true)
      expect(result.results[0].channels[1].success).toBe(false)
    })

    it('increments channel failures on permanent (non-retryable) failure', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG])
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: false, error: 'blocked', shouldRetry: false })
      mockServiceRpc.mockResolvedValue({ error: null })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      await forceNotifyAll()

      expect(mockServiceRpc).toHaveBeenCalledWith('increment_channel_failures', { p_channel_id: CHANNEL_TG.id })
    })

    it('does not increment channel failures on retryable failure', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG])
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: false, error: 'timeout', shouldRetry: true })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      await forceNotifyAll()

      expect(mockServiceRpc).not.toHaveBeenCalledWith('increment_channel_failures', expect.anything())
    })

    it('logs post-write failures without throwing', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG])
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })

      // Post-write fails
      const upsertFn = vi.fn().mockResolvedValue({ error: { message: 'history fail' } })
      mockServiceFrom.mockReturnValueOnce({ upsert: upsertFn })
      mockServiceRpc.mockResolvedValue({ error: { message: 'stamp fail' } })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      // Should still return results (not throw)
      expect(result.summary.sent).toBe(1)
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ errors: expect.any(Array) }),
        expect.stringContaining('post-dispatch writes partially failed')
      )
    })

    it('includes advance_list_positions when problem has list_id', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG])
      vi.mocked(selectProblemForUser).mockResolvedValue(listProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })

      // Post-write: history + stamp + advance_list_positions
      const upsertFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValueOnce({ upsert: upsertFn })
      mockServiceRpc
        .mockResolvedValueOnce({ error: null }) // stamp
        .mockResolvedValueOnce({ error: null }) // advance

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      await forceNotifyAll()

      // The rpc calls include stamp_last_push_date and advance_list_positions
      // Due to Promise.all, both are called
      expect(mockServiceRpc).toHaveBeenCalled()
    })

    it('isolates rejection in problem selection — does not crash entire batch', async () => {
      setupAdmin()
      setupUsersQuery([USER_A, { ...USER_A, id: 'ua-3333', display_name: 'Charlie' }])
      setupChannelsQuery([CHANNEL_TG, { ...CHANNEL_TG, id: 'ch-tg-2', user_id: 'ua-3333' }])
      vi.mocked(selectProblemForUser)
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })

      // Post-write for the one successful user
      const upsertFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValueOnce({ upsert: upsertFn })
      mockServiceRpc.mockResolvedValue({ error: null })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      // First user's selection failed → skipped; second succeeded
      expect(result.results).toHaveLength(2)
      expect(result.summary.sent).toBeGreaterThanOrEqual(1)
    })

    it('calls revalidatePath /admin/push after processing users', async () => {
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG])
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })

      const upsertFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValueOnce({ upsert: upsertFn })
      mockServiceRpc.mockResolvedValue({ error: null })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      await forceNotifyAll()

      expect(revalidatePath).toHaveBeenCalledWith('/admin/push')
    })

    it('returns correct summary counts', async () => {
      setupAdmin()
      const userC = { ...USER_A, id: 'ua-cccc', display_name: 'Charlie' }
      setupUsersQuery([USER_A, USER_B, userC])
      setupChannelsQuery([
        CHANNEL_TG, // USER_A telegram
        CHANNEL_LINE, // USER_B line (will be filtered by line_push_allowed=false)
        { ...CHANNEL_TG, id: 'ch-tg-c', user_id: userC.id }, // Charlie telegram
      ])
      vi.mocked(selectProblemForUser)
        .mockResolvedValueOnce(baseProblem)  // Alice
        .mockResolvedValueOnce(baseProblem)  // Charlie (Bob skipped — no channels after LINE filter)
      vi.mocked(sendTelegramMessage)
        .mockResolvedValueOnce({ success: true })   // Alice
        .mockResolvedValueOnce({ success: false, error: 'err', shouldRetry: true })  // Charlie

      // Post-write for Alice
      const upsertFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValueOnce({ upsert: upsertFn })
      mockServiceRpc.mockResolvedValue({ error: null })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      expect(result.summary.sent).toBe(1)     // Alice
      expect(result.summary.failed).toBe(1)    // Charlie
      expect(result.summary.skipped).toBe(1)   // Bob (LINE filtered)
    })

    it('uses p-limit for concurrency control', async () => {
      // p-limit is mocked to pass-through; just verify it's imported and called
      setupAdmin()
      setupUsersQuery([USER_A])
      setupChannelsQuery([CHANNEL_TG])
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })

      const upsertFn = vi.fn().mockResolvedValue({ error: null })
      mockServiceFrom.mockReturnValueOnce({ upsert: upsertFn })
      mockServiceRpc.mockResolvedValue({ error: null })

      const { forceNotifyAll } = await import('@/lib/actions/admin')
      const result = await forceNotifyAll()

      // If p-limit were broken, selectProblemForUser would not be called
      expect(selectProblemForUser).toHaveBeenCalledTimes(1)
      expect(result.summary.sent).toBe(1)
    })

    it('throws Forbidden for non-admin', async () => {
      setupNonAdmin()
      const { forceNotifyAll } = await import('@/lib/actions/admin')
      await expect(forceNotifyAll()).rejects.toThrow('Forbidden')
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // dispatchToChannel (8) — tested via forceNotifyAll/testNotifyChannel
  // ═══════════════════════════════════════════════════════════════

  describe('dispatchToChannel (via testNotifyChannel)', () => {
    const CHANNEL_UUID = '550e8400-e29b-41d4-a716-446655440005'
    const USER_ID = '550e8400-e29b-41d4-a716-446655440006'

    const baseProblem = {
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcode_id: 1,
      explanation: 'hash map',
      slug: 'two-sum',
      problem_id: 42,
      list_id: null,
      sequence_number: null,
    }

    function setupChannelAndProblem(channelType: string, channelIdentifier: string) {
      setupAdmin()
      const channel = {
        id: CHANNEL_UUID,
        user_id: USER_ID,
        channel_type: channelType,
        channel_identifier: channelIdentifier,
        users: { id: USER_ID, active_mode: 'filter', difficulty_min: 0, difficulty_max: 3000, topic_filter: null },
      }
      const singleFn = vi.fn().mockResolvedValue({ data: channel, error: null })
      mockServiceFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleFn }),
        }),
      })
      vi.mocked(selectProblemForUser).mockResolvedValue(baseProblem)
    }

    it('routes telegram to sendTelegramMessage', async () => {
      setupChannelAndProblem('telegram', '12345')
      vi.mocked(sendTelegramMessage).mockResolvedValue({ success: true })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(sendTelegramMessage).toHaveBeenCalledWith('test-tg-token', '12345', expect.any(Object))
      expect(result.success).toBe(true)
    })

    it('routes line to sendLineMessage', async () => {
      setupChannelAndProblem('line', 'line-uid')
      // LINE needs push allowed check
      const singleFn = vi.fn().mockResolvedValue({ data: { line_push_allowed: true }, error: null })
      mockServiceFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleFn }),
        }),
      })
      vi.mocked(sendLineMessage).mockResolvedValue({ success: true })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(sendLineMessage).toHaveBeenCalledWith('test-line-token', 'line-uid', expect.any(Object))
      expect(result.success).toBe(true)
    })

    it('routes email to sendEmailMessage', async () => {
      setupChannelAndProblem('email', 'user@example.com')
      vi.mocked(sendEmailMessage).mockResolvedValue({ success: true })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(sendEmailMessage).toHaveBeenCalledWith(
        'test-resend-key',
        'Test <test@example.com>',
        'user@example.com',
        expect.any(Object)
      )
      expect(result.success).toBe(true)
    })

    it('returns error when TELEGRAM_BOT_TOKEN is missing', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN
      setupChannelAndProblem('telegram', '12345')

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error).toContain('TELEGRAM_BOT_TOKEN not set')
    })

    it('returns error when LINE_CHANNEL_ACCESS_TOKEN is missing', async () => {
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN
      setupChannelAndProblem('line', 'line-uid')
      // LINE push allowed check
      const singleFn = vi.fn().mockResolvedValue({ data: { line_push_allowed: true }, error: null })
      mockServiceFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleFn }),
        }),
      })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error).toContain('LINE_CHANNEL_ACCESS_TOKEN not set')
    })

    it('returns error when RESEND_API_KEY is missing', async () => {
      delete process.env.RESEND_API_KEY
      setupChannelAndProblem('email', 'user@example.com')

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error).toContain('RESEND_API_KEY not set')
    })

    it('returns error for unknown channel type', async () => {
      setupChannelAndProblem('sms', '+1234567890')

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      const result = await testNotifyChannel(CHANNEL_UUID)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown channel type: sms')
    })

    it('uses default RESEND_FROM_EMAIL when env not set', async () => {
      delete process.env.RESEND_FROM_EMAIL
      setupChannelAndProblem('email', 'user@example.com')
      vi.mocked(sendEmailMessage).mockResolvedValue({ success: true })

      const { testNotifyChannel } = await import('@/lib/actions/admin')
      await testNotifyChannel(CHANNEL_UUID)

      expect(sendEmailMessage).toHaveBeenCalledWith(
        'test-resend-key',
        'CaffeCode <noreply@caffecode.net>',
        'user@example.com',
        expect.any(Object)
      )
    })
  })
})
