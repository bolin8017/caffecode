import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockIdentify = vi.fn()
const mockCapture = vi.fn()

vi.mock('posthog-js', () => ({
  default: {
    __loaded: false,
    identify: mockIdentify,
    capture: mockCapture,
  },
}))

// In Node env (vitest default), `typeof window` is 'undefined'.
// analytics.ts isReady() checks `typeof window !== 'undefined' && posthog.__loaded`.
// We need to stub `window` for the "ready" tests.

let posthogMod: typeof import('posthog-js')

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  // Re-apply mock after resetModules
  vi.doMock('posthog-js', () => ({
    default: {
      __loaded: false,
      identify: mockIdentify,
      capture: mockCapture,
    },
  }))
  posthogMod = await import('posthog-js')
})

afterEach(() => {
  // Clean up window stub if set
  if ('window' in globalThis && (globalThis as Record<string, unknown>).__windowStubbed) {
    // @ts-expect-error restoring original state
    delete globalThis.window
    delete (globalThis as Record<string, unknown>).__windowStubbed
  }
})

async function importReady() {
  // Stub window so typeof window !== 'undefined'
  if (typeof globalThis.window === 'undefined') {
    vi.stubGlobal('window', {})
    ;(globalThis as Record<string, unknown>).__windowStubbed = true
  }
  // Set __loaded on the mock
  ;(posthogMod.default as unknown as { __loaded: boolean }).__loaded = true
  // Re-import analytics to pick up the state
  return await import('../analytics')
}

async function importNotReady() {
  // Ensure __loaded is false (already default from mock)
  return await import('../analytics')
}

describe('identifyUser', () => {
  it('does nothing when PostHog is not ready', async () => {
    const { identifyUser } = await importNotReady()
    identifyUser('user-1', 'a@b.com')
    expect(mockIdentify).not.toHaveBeenCalled()
  })

  it('calls posthog.identify with userId and email when ready', async () => {
    const { identifyUser } = await importReady()
    identifyUser('user-1', 'a@b.com')
    expect(mockIdentify).toHaveBeenCalledWith('user-1', { email: 'a@b.com' })
  })

  it('passes undefined email when email is null', async () => {
    const { identifyUser } = await importReady()
    identifyUser('user-1', null)
    expect(mockIdentify).toHaveBeenCalledWith('user-1', { email: undefined })
  })
})

describe('trackSolveMarked', () => {
  it('does nothing when PostHog is not ready', async () => {
    const { trackSolveMarked } = await importNotReady()
    trackSolveMarked({ problemId: 1, source: 'problem', timeSinceSentSec: 120 })
    expect(mockCapture).not.toHaveBeenCalled()
  })

  it('captures problem_solve_marked with correct properties when ready', async () => {
    const { trackSolveMarked } = await importReady()
    trackSolveMarked({ problemId: 42, source: 'dashboard', timeSinceSentSec: 300 })
    expect(mockCapture).toHaveBeenCalledWith('problem_solve_marked', {
      problem_id: 42,
      source: 'dashboard',
      time_since_sent_sec: 300,
    })
  })

  it('handles null timeSinceSentSec gracefully', async () => {
    const { trackSolveMarked } = await importReady()
    trackSolveMarked({ problemId: 7, source: 'telegram', timeSinceSentSec: null })
    expect(mockCapture).toHaveBeenCalledWith('problem_solve_marked', {
      problem_id: 7,
      source: 'telegram',
      time_since_sent_sec: null,
    })
  })
})

describe('trackGardenVisited', () => {
  it('does nothing when PostHog is not ready', async () => {
    const { trackGardenVisited } = await importNotReady()
    trackGardenVisited({ topicCount: 5, maxSolvedTopic: 'array' })
    expect(mockCapture).not.toHaveBeenCalled()
  })

  it('captures garden_visited with correct properties when ready', async () => {
    const { trackGardenVisited } = await importReady()
    trackGardenVisited({ topicCount: 12, maxSolvedTopic: 'dynamic-programming' })
    expect(mockCapture).toHaveBeenCalledWith('garden_visited', {
      topic_count: 12,
      max_solved_topic: 'dynamic-programming',
    })
  })

  it('handles null maxSolvedTopic gracefully', async () => {
    const { trackGardenVisited } = await importReady()
    trackGardenVisited({ topicCount: 0, maxSolvedTopic: null })
    expect(mockCapture).toHaveBeenCalledWith('garden_visited', {
      topic_count: 0,
      max_solved_topic: null,
    })
  })
})
