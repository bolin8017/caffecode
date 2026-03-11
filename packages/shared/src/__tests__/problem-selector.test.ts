import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test so that
// vi.mock() hoisting replaces the imports when problem-selector.ts is loaded.
// ---------------------------------------------------------------------------
vi.mock('../repositories/problem.repository.js', () => ({
  getListProblemAtPosition: vi.fn(),
  getProblemAtListPosition: vi.fn(),
  getUnsentProblemIds: vi.fn(),
  getProblemById: vi.fn(),
}))

import {
  getListProblemAtPosition,
  getProblemAtListPosition,
  getUnsentProblemIds,
  getProblemById,
} from '../repositories/problem.repository.js'
import { selectProblemForUser } from '../services/problem-selector.js'
import type { SelectedProblem } from '../types/push.js'

// Typed mock helpers
const mockGetListProblemAtPosition = vi.mocked(getListProblemAtPosition)
const mockGetProblemAtListPosition = vi.mocked(getProblemAtListPosition)
const mockGetUnsentProblemIds = vi.mocked(getUnsentProblemIds)
const mockGetProblemById = vi.mocked(getProblemById)

// A minimal fake SupabaseClient (never actually called — mocks intercept first)
const fakeSupabase = {} as unknown as SupabaseClient

// A sample resolved problem used across tests
const resolvedProblem: SelectedProblem = {
  problem_id: 42,
  leetcode_id: 42,
  slug: 'trapping-rain-water',
  title: 'Trapping Rain Water',
  difficulty: 'Hard',
  explanation: 'Use two-pointer approach.',
}

const baseUser = {
  id: 'user-uuid-1234',
  mode: 'filter' as const,
  difficulty_min: 1000,
  difficulty_max: 2000,
  topic_filter: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Filter mode
// ---------------------------------------------------------------------------
describe('selectProblemForUser — filter mode', () => {
  it('with exactly 1 unsent problem always selects it', async () => {
    mockGetUnsentProblemIds.mockResolvedValue([42])
    mockGetProblemById.mockResolvedValue(resolvedProblem)

    const result = await selectProblemForUser(baseUser, fakeSupabase)

    expect(mockGetProblemById).toHaveBeenCalledWith(fakeSupabase, 42)
    expect(result).toEqual(resolvedProblem)
  })

  it('with empty unsent list returns null without calling getProblemById', async () => {
    mockGetUnsentProblemIds.mockResolvedValue([])

    const result = await selectProblemForUser(baseUser, fakeSupabase)

    expect(result).toBeNull()
    expect(mockGetProblemById).not.toHaveBeenCalled()
  })

  it('propagates error when getUnsentProblemIds throws', async () => {
    mockGetUnsentProblemIds.mockRejectedValue(new Error('getUnsentProblemIds: RPC failed: connection refused'))

    await expect(selectProblemForUser(baseUser, fakeSupabase)).rejects.toThrow('RPC failed')
  })

  it('selects randomly when multiple unsent problems available', async () => {
    const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    mockGetUnsentProblemIds.mockResolvedValue([10, 20, 30])
    mockGetProblemById.mockResolvedValue(resolvedProblem)

    await selectProblemForUser(baseUser, fakeSupabase)

    // Math.floor(0.99 * 3) = 2 → selects index 2 → problem ID 30
    expect(mockGetProblemById).toHaveBeenCalledWith(fakeSupabase, 30)
    mockRandom.mockRestore()
  })

  it('returns null when getProblemById returns null', async () => {
    mockGetUnsentProblemIds.mockResolvedValue([42])
    mockGetProblemById.mockResolvedValue(null)

    const result = await selectProblemForUser(baseUser, fakeSupabase)
    expect(result).toBeNull()
  })

  it('passes topic_filter to getUnsentProblemIds', async () => {
    const userWithTopics = { ...baseUser, topic_filter: ['array', 'string'] }
    mockGetUnsentProblemIds.mockResolvedValue([])

    await selectProblemForUser(userWithTopics, fakeSupabase)

    expect(mockGetUnsentProblemIds).toHaveBeenCalledWith(
      fakeSupabase,
      userWithTopics.id,
      userWithTopics.difficulty_min,
      userWithTopics.difficulty_max,
      ['array', 'string']
    )
  })

  it('passes null topic_filter when not specified', async () => {
    mockGetUnsentProblemIds.mockResolvedValue([])

    await selectProblemForUser(baseUser, fakeSupabase)

    expect(mockGetUnsentProblemIds).toHaveBeenCalledWith(
      fakeSupabase,
      baseUser.id,
      baseUser.difficulty_min,
      baseUser.difficulty_max,
      null
    )
  })

  it('passes difficulty_min and difficulty_max correctly', async () => {
    const customUser = { ...baseUser, difficulty_min: 1500, difficulty_max: 2200 }
    mockGetUnsentProblemIds.mockResolvedValue([])

    await selectProblemForUser(customUser, fakeSupabase)

    expect(mockGetUnsentProblemIds).toHaveBeenCalledWith(
      fakeSupabase,
      customUser.id,
      1500,
      2200,
      null
    )
  })
})

// ---------------------------------------------------------------------------
// List mode
// ---------------------------------------------------------------------------
describe('selectProblemForUser — list mode', () => {
  const listUser = { ...baseUser, mode: 'list' as const }

  it('returns null when no active list progress found', async () => {
    mockGetListProblemAtPosition.mockResolvedValue(null)

    const result = await selectProblemForUser(listUser, fakeSupabase)

    expect(result).toBeNull()
    expect(mockGetProblemAtListPosition).not.toHaveBeenCalled()
  })

  it('returns null when the problem at list position has no content (null)', async () => {
    mockGetListProblemAtPosition.mockResolvedValue({ list_id: 7, current_position: 3 })
    // getProblemAtListPosition returns null when problem_content is null
    mockGetProblemAtListPosition.mockResolvedValue(null)

    const result = await selectProblemForUser(listUser, fakeSupabase)

    expect(result).toBeNull()
  })

  it('returns the problem when list progress and content are both available', async () => {
    mockGetListProblemAtPosition.mockResolvedValue({ list_id: 7, current_position: 0 })
    mockGetProblemAtListPosition.mockResolvedValue(resolvedProblem)

    const result = await selectProblemForUser(listUser, fakeSupabase)

    expect(mockGetProblemAtListPosition).toHaveBeenCalledWith(fakeSupabase, 7, 0)
    expect(result).toEqual(resolvedProblem)
  })

  it('passes correct list_id and current_position to getProblemAtListPosition', async () => {
    const listUser2 = { ...baseUser, mode: 'list' as const }
    mockGetListProblemAtPosition.mockResolvedValue({ list_id: 12, current_position: 8 })
    mockGetProblemAtListPosition.mockResolvedValue(resolvedProblem)

    await selectProblemForUser(listUser2, fakeSupabase)

    expect(mockGetProblemAtListPosition).toHaveBeenCalledWith(fakeSupabase, 12, 8)
  })
})
