// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnsolvedQueue } from '@/app/(auth)/dashboard/unsolved-queue'

const mockMarkSolved = vi.fn()
vi.mock('@/lib/actions/history', () => ({ markSolved: (...args: unknown[]) => mockMarkSolved(...args) }))
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

    // Click the first solve button (compact variant has title="標記已解題")
    const solveButtons = screen.getAllByTitle('標記已解題')
    await user.click(solveButtons[0])

    // Item should be optimistically removed
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

    // Item should reappear after error
    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeInTheDocument()
    })

    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('標記失敗，請再試一次')
  })
})
