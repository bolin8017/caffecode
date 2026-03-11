// apps/web/lib/__tests__/feedback-action.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// Supabase chain mock
const mockProblemSingle = vi.fn()
const mockUpsert = vi.fn()
const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: mockProblemSingle,
  upsert: mockUpsert,
}
const mockFrom = vi.fn().mockReturnValue(mockChain)
const mockSupabase = { from: mockFrom }

import { getAuthUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

function setupAuth(userId = 'user-123') {
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: mockSupabase as unknown,
    user: { id: userId } as unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

describe('submitFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuth()
    // Default: problem exists
    mockProblemSingle.mockResolvedValue({ data: { id: 42 }, error: null })
    // Default: upsert succeeds
    mockUpsert.mockResolvedValue({ error: null })
  })

  // ─── Happy path ───

  it('submits difficulty only', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await submitFeedback(42, 'too_easy', undefined)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        problem_id: 42,
        difficulty: 'too_easy',
      }),
      { onConflict: 'user_id,problem_id' }
    )
  })

  it('submits contentScore only', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await submitFeedback(42, undefined, 4)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        problem_id: 42,
        content_score: 4,
      }),
      { onConflict: 'user_id,problem_id' }
    )
    // Should NOT contain difficulty key
    const upsertArg = mockUpsert.mock.calls[0][0]
    expect(upsertArg).not.toHaveProperty('difficulty')
  })

  it('submits both difficulty and contentScore', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await submitFeedback(42, 'just_right', 5)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: 'just_right',
        content_score: 5,
      }),
      { onConflict: 'user_id,problem_id' }
    )
  })

  // ─── Revalidation ───

  it('revalidates /admin/content when contentScore provided', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await submitFeedback(42, undefined, 3)

    expect(revalidatePath).toHaveBeenCalledWith('/admin/content')
  })

  it('does NOT revalidate when only difficulty provided', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await submitFeedback(42, 'too_hard', undefined)

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  // ─── Zod validation ───

  it('throws ZodError for non-positive problemId', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await expect(submitFeedback(-1, 'too_easy')).rejects.toThrow()
  })

  it('throws ZodError for non-integer problemId', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await expect(submitFeedback(1.5, 'too_easy')).rejects.toThrow()
  })

  it('throws ZodError for zero problemId', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await expect(submitFeedback(0, 'too_easy')).rejects.toThrow()
  })

  it('throws ZodError for contentScore < 1', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await expect(submitFeedback(42, undefined, 0)).rejects.toThrow()
  })

  it('throws ZodError for contentScore > 5', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await expect(submitFeedback(42, undefined, 6)).rejects.toThrow()
  })

  it('throws ZodError for non-integer contentScore', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await expect(submitFeedback(42, undefined, 3.5)).rejects.toThrow()
  })

  // ─── Error handling ───

  it('throws when problem not found (select returns null data)', async () => {
    mockProblemSingle.mockResolvedValue({ data: null, error: null })

    const { submitFeedback } = await import('@/lib/actions/feedback')
    await expect(submitFeedback(42, 'too_easy')).rejects.toThrow('Problem not found')
  })

  it('throws when problem check returns error', async () => {
    mockProblemSingle.mockResolvedValue({ data: null, error: { message: 'DB down' } })

    const { submitFeedback } = await import('@/lib/actions/feedback')
    await expect(submitFeedback(42, 'too_easy')).rejects.toThrow('Problem not found')
  })

  it('throws when upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'upsert failed' } })

    const { submitFeedback } = await import('@/lib/actions/feedback')
    await expect(submitFeedback(42, 'too_easy')).rejects.toThrow('Failed to submit feedback')
  })

  // ─── Edge cases ───

  it('uses onConflict with (user_id, problem_id)', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await submitFeedback(42, 'just_right')

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      { onConflict: 'user_id,problem_id' }
    )
  })

  it('accepts contentScore boundary value 1', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await submitFeedback(42, undefined, 1)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ content_score: 1 }),
      expect.anything()
    )
  })

  it('accepts contentScore boundary value 5', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    await submitFeedback(42, undefined, 5)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ content_score: 5 }),
      expect.anything()
    )
  })

  it('does not throw when both difficulty and contentScore are undefined', async () => {
    const { submitFeedback } = await import('@/lib/actions/feedback')
    // Both optional — Zod allows it, upsert still runs with just user_id + problem_id
    await submitFeedback(42, undefined, undefined)
    expect(mockUpsert).toHaveBeenCalled()
  })
})
