// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingWizard } from '@/app/(auth)/onboarding/onboarding-wizard'

const mockCompleteOnboarding = vi.fn()
vi.mock('@/lib/actions/onboarding', () => ({
  completeOnboarding: (...args: unknown[]) => mockCompleteOnboarding(...args),
}))
vi.mock('@/app/(auth)/settings/notifications/email-connect-button', () => ({
  EmailConnectButton: () => <button type="button">Mock Email Connect</button>,
}))

const LISTS = [
  { id: 1, name: 'Blind 75', problem_count: 75 },
  { id: 2, name: 'NeetCode 150', problem_count: 150 },
]

describe('OnboardingWizard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts at step 1 with mode selection', () => {
    render(<OnboardingWizard lists={LISTS} />)
    expect(screen.getByText('選擇學習模式')).toBeInTheDocument()
    expect(screen.getByText('清單模式')).toBeInTheDocument()
    expect(screen.getByText('篩選模式')).toBeInTheDocument()
  })

  it('shows step indicator with 4 steps', () => {
    render(<OnboardingWizard lists={LISTS} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  })

  it('advances to step 2 (list) when clicking list mode', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard lists={LISTS} />)

    await user.click(screen.getByText('清單模式'))

    expect(screen.getByText('選擇學習清單')).toBeInTheDocument()
    expect(screen.getByText('Blind 75')).toBeInTheDocument()
    expect(screen.getByText('NeetCode 150')).toBeInTheDocument()
  })

  it('advances to step 2 (filter) when clicking filter mode', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard lists={LISTS} />)

    await user.click(screen.getByText('篩選模式'))

    expect(screen.getByText('設定難度範圍')).toBeInTheDocument()
    expect(screen.getByText(/≤ 1300/)).toBeInTheDocument()
  })

  it('back button returns to previous step', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard lists={LISTS} />)

    await user.click(screen.getByText('篩選模式'))
    expect(screen.getByText('設定難度範圍')).toBeInTheDocument()

    await user.click(screen.getByText('上一步'))
    expect(screen.getByText('選擇學習模式')).toBeInTheDocument()
  })

  it('navigates through all steps and calls completeOnboarding', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard lists={LISTS} />)

    // Step 1 → select list mode
    await user.click(screen.getByText('清單模式'))

    // Step 2 → select a list then next
    await user.click(screen.getByText('Blind 75'))
    await user.click(screen.getByText('下一步'))

    // Step 3 → timezone & hour (keep defaults), click next
    expect(screen.getByText('設定通知時間')).toBeInTheDocument()
    await user.click(screen.getByText('下一步'))

    // Step 4 → finish
    expect(screen.getByText('連結通知頻道')).toBeInTheDocument()
    await user.click(screen.getByText('完成設定'))

    expect(mockCompleteOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'list',
        list_id: 1,
      }),
    )
  })

  it('disables next button on step 2 (list) until a list is selected', async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard lists={LISTS} />)

    await user.click(screen.getByText('清單模式'))

    // "下一步" should be disabled before selecting a list
    expect(screen.getByText('下一步')).toBeDisabled()

    // Select a list
    await user.click(screen.getByText('NeetCode 150'))
    expect(screen.getByText('下一步')).not.toBeDisabled()
  })
})
