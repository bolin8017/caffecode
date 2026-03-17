// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnsolvedQueue } from '@/app/(auth)/dashboard/unsolved-queue'

const mockMarkSolved = vi.fn()
const mockSkipProblem = vi.fn()
vi.mock('@/lib/actions/history', () => ({
  markSolved: (...args: unknown[]) => mockMarkSolved(...args),
  skipProblem: (...args: unknown[]) => mockSkipProblem(...args),
}))
vi.mock('@/lib/analytics', () => ({ trackSolveMarked: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('@/components/solve-feedback', () => ({ SolveFeedback: () => null }))

const ITEMS = [
  { problemId: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', sentAt: '2026-03-01T00:00:00Z' },
  { problemId: 2, title: 'Add Two Numbers', slug: 'add-two-numbers', difficulty: 'Medium', sentAt: '2026-03-02T00:00:00Z' },
]

const FIVE_ITEMS = [
  { problemId: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 'Easy', sentAt: '2026-03-01T00:00:00Z' },
  { problemId: 2, title: 'Add Two Numbers', slug: 'add-two-numbers', difficulty: 'Medium', sentAt: '2026-03-02T00:00:00Z' },
  { problemId: 3, title: 'Longest Substring', slug: 'longest-substring', difficulty: 'Medium', sentAt: '2026-03-03T00:00:00Z' },
  { problemId: 4, title: 'Median of Two', slug: 'median-of-two', difficulty: 'Hard', sentAt: '2026-03-04T00:00:00Z' },
  { problemId: 5, title: 'Longest Palindromic', slug: 'longest-palindromic', difficulty: 'Medium', sentAt: '2026-03-05T00:00:00Z' },
]

describe('UnsolvedQueue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows empty message when no items', () => {
    render(<UnsolvedQueue items={[]} />)
    expect(screen.getByText(/所有題目都完成了/)).toBeInTheDocument()
  })

  it('renders item titles as links', () => {
    render(<UnsolvedQueue items={ITEMS} />)
    expect(screen.getByText('Two Sum')).toBeInTheDocument()
    expect(screen.getByText('Add Two Numbers')).toBeInTheDocument()
    expect(screen.getByText('Two Sum').closest('a')).toHaveAttribute('href', '/problems/two-sum')
  })

  it('renders difficulty badges', () => {
    render(<UnsolvedQueue items={ITEMS} />)
    expect(screen.getByText('簡單')).toBeInTheDocument()
    expect(screen.getByText('中等')).toBeInTheDocument()
  })

  it('optimistically removes item on solve click', async () => {
    mockMarkSolved.mockResolvedValue({
      levelUps: [], newBadges: [], topicProgress: [], firstSolve: false,
    })
    const user = userEvent.setup()
    render(<UnsolvedQueue items={ITEMS} />)

    const solveButtons = screen.getAllByTitle('標記已解題')
    await user.click(solveButtons[0])

    await waitFor(() => {
      expect(screen.queryByText('Two Sum')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Add Two Numbers')).toBeInTheDocument()
  })

  it('restores item and shows toast on solve failure', async () => {
    mockMarkSolved.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<UnsolvedQueue items={ITEMS} />)

    const solveButtons = screen.getAllByTitle('標記已解題')
    await user.click(solveButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeInTheDocument()
    })

    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('標記失敗，請再試一次')
  })

  // --- Collapse behavior ---

  it('shows only 3 items by default when more than 3 exist', () => {
    render(<UnsolvedQueue items={FIVE_ITEMS} />)
    expect(screen.getByText('Two Sum')).toBeInTheDocument()
    expect(screen.getByText('Add Two Numbers')).toBeInTheDocument()
    expect(screen.getByText('Longest Substring')).toBeInTheDocument()
    expect(screen.queryByText('Median of Two')).not.toBeInTheDocument()
    expect(screen.queryByText('Longest Palindromic')).not.toBeInTheDocument()
    expect(screen.getByText('還有 2 題')).toBeInTheDocument()
  })

  it('expands to show all items when expand button is clicked', async () => {
    const user = userEvent.setup()
    render(<UnsolvedQueue items={FIVE_ITEMS} />)

    await user.click(screen.getByText('還有 2 題'))

    expect(screen.getByText('Median of Two')).toBeInTheDocument()
    expect(screen.getByText('Longest Palindromic')).toBeInTheDocument()
    expect(screen.queryByText('還有 2 題')).not.toBeInTheDocument()
  })

  it('does not show expand button when 3 or fewer items', () => {
    render(<UnsolvedQueue items={ITEMS} />)
    expect(screen.queryByText(/還有/)).not.toBeInTheDocument()
  })

  // --- Skip behavior ---

  it('optimistically removes item on skip click', async () => {
    mockSkipProblem.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<UnsolvedQueue items={ITEMS} />)

    const skipButtons = screen.getAllByTitle('跳過')
    await user.click(skipButtons[0])

    await waitFor(() => {
      expect(screen.queryByText('Two Sum')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Add Two Numbers')).toBeInTheDocument()
    expect(mockSkipProblem).toHaveBeenCalledWith(1)
  })

  it('restores item and shows toast on skip failure', async () => {
    mockSkipProblem.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<UnsolvedQueue items={ITEMS} />)

    const skipButtons = screen.getAllByTitle('跳過')
    await user.click(skipButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeInTheDocument()
    })

    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('跳過失敗，請再試一次')
  })
})
