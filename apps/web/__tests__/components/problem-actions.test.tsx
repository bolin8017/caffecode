// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProblemActions } from '@/app/(public)/problems/[slug]/problem-actions'
import type { SolveResult } from '@/lib/utils/solve-result'

const mockMarkSolved = vi.fn()
vi.mock('@/lib/actions/history', () => ({ markSolved: (...args: unknown[]) => mockMarkSolved(...args) }))
vi.mock('@/lib/analytics', () => ({ trackSolveMarked: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('@/components/solve-feedback', () => ({ SolveFeedback: () => null }))

// Mock IntersectionObserver
let observerCallback: IntersectionObserverCallback
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { observerCallback = cb }
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()
  })
})

const RESULT: SolveResult = { levelUps: [], newBadges: [], topicProgress: [], firstSolve: false }
const BASE = {
  problemId: 1,
  initialSolvedAt: null,
  sentAt: '2026-03-01T00:00:00Z',
  slug: 'two-sum',
  leetcodeId: 1,
  title: 'Two Sum',
  difficulty: 'Easy',
}

describe('ProblemActions', () => {
  it('renders LeetCode link', () => {
    render(<ProblemActions {...BASE} />)
    expect(screen.getByText(/在 LeetCode 上作答/)).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/two-sum/',
    )
  })

  it('renders solve buttons in both header and sticky bar when unsolved', () => {
    render(<ProblemActions {...BASE} />)
    // Header + sticky bar each have a SolveButton
    expect(screen.getAllByText(/我解出來了/).length).toBe(2)
  })

  it('renders completed status when already solved', () => {
    render(<ProblemActions {...BASE} initialSolvedAt="2026-01-01T00:00:00Z" />)
    expect(screen.getAllByText(/已標記完成/).length).toBeGreaterThan(0)
  })

  it('calls markSolved and updates state on solve', async () => {
    mockMarkSolved.mockResolvedValue(RESULT)
    const user = userEvent.setup()
    render(<ProblemActions {...BASE} />)

    // Click the first (header) solve button
    await user.click(screen.getAllByText(/我解出來了/)[0])

    await waitFor(() => {
      expect(mockMarkSolved).toHaveBeenCalledWith(1)
    })
  })

  it('shows error message on solve failure', async () => {
    mockMarkSolved.mockRejectedValue(new Error('DB error'))
    const user = userEvent.setup()
    render(<ProblemActions {...BASE} />)

    await user.click(screen.getAllByText(/我解出來了/)[0])

    await waitFor(() => {
      expect(screen.getAllByText('DB error').length).toBeGreaterThan(0)
    })
  })

  it('shows sticky bar when sentinel is not intersecting', async () => {
    const { container } = render(<ProblemActions {...BASE} />)

    // Simulate sentinel leaving viewport
    const { act } = await import('@testing-library/react')
    act(() => {
      observerCallback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    // The sticky bar should have translate-y-0 (visible) when showSticky=true and not solved
    const stickyBar = container.querySelector('.fixed.bottom-0')
    expect(stickyBar).toHaveClass('translate-y-0')
  })
})
