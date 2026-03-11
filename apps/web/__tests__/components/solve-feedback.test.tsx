// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { SolveFeedback } from '@/components/solve-feedback'
import type { SolveResult } from '@/lib/utils/solve-result'

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: mockToast }))
vi.mock('@caffecode/shared', () => ({ topicLabel: (t: string) => t }))
vi.mock('@/components/solve-celebration-modal', () => ({
  SolveCelebrationModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="celebration-modal">
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

const PROGRESS_RESULT: SolveResult = {
  levelUps: [],
  newBadges: [],
  topicProgress: [{ topic: 'array', solvedCount: 3, nextThreshold: 6, level: 2 }],
  firstSolve: false,
}

const LEVELUP_RESULT: SolveResult = {
  levelUps: [{ topic: 'array', variety: 'Arabica', oldLevel: 1, newLevel: 2, newStage: 2 }],
  newBadges: [],
  topicProgress: [{ topic: 'array', solvedCount: 6, nextThreshold: 11, level: 3 }],
  firstSolve: false,
}

const BADGE_RESULT: SolveResult = {
  levelUps: [],
  newBadges: [{ name: 'First Step', icon: '🏅' }],
  topicProgress: [],
  firstSolve: false,
}

describe('SolveFeedback', () => {
  const onDismiss = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing when result is null', () => {
    const { container } = render(<SolveFeedback result={null} onDismiss={onDismiss} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows toast for progress-only result and calls onDismiss', () => {
    render(<SolveFeedback result={PROGRESS_RESULT} onDismiss={onDismiss} />)
    expect(mockToast.success).toHaveBeenCalledWith(
      expect.stringContaining('array 3/6'),
    )
    expect(onDismiss).toHaveBeenCalled()
  })

  it('renders celebration modal for level-up result', () => {
    const { getByTestId } = render(
      <SolveFeedback result={LEVELUP_RESULT} onDismiss={onDismiss} />,
    )
    expect(getByTestId('celebration-modal')).toBeInTheDocument()
    // Toast should NOT fire for level-up results
    expect(mockToast.success).not.toHaveBeenCalled()
  })

  it('renders celebration modal for badge result', () => {
    const { getByTestId } = render(
      <SolveFeedback result={BADGE_RESULT} onDismiss={onDismiss} />,
    )
    expect(getByTestId('celebration-modal')).toBeInTheDocument()
    expect(mockToast.success).not.toHaveBeenCalled()
  })

  it('does not fire duplicate toast on re-render with same result', () => {
    const { rerender } = render(
      <SolveFeedback result={PROGRESS_RESULT} onDismiss={onDismiss} />,
    )
    expect(mockToast.success).toHaveBeenCalledTimes(1)

    // Re-render with same result reference
    rerender(<SolveFeedback result={PROGRESS_RESULT} onDismiss={onDismiss} />)
    expect(mockToast.success).toHaveBeenCalledTimes(1)
  })
})
