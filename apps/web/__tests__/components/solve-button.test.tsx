// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SolveButton } from '@/components/solve-button'

describe('SolveButton', () => {
  const onSolve = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  const base = { problemId: 1, solvedAt: null as string | null, onSolve, isPending: false }

  describe('default variant', () => {
    it('renders solve button when unsolved', () => {
      render(<SolveButton {...base} />)
      expect(screen.getByRole('button')).toHaveTextContent('我解出來了')
    })

    it('renders status when solved', () => {
      render(<SolveButton {...base} solvedAt="2026-01-01T00:00:00Z" />)
      expect(screen.getByRole('status')).toHaveTextContent('已標記完成')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows loading text when pending', () => {
      render(<SolveButton {...base} isPending />)
      const btn = screen.getByRole('button')
      expect(btn).toHaveTextContent('記錄中')
      expect(btn).toBeDisabled()
    })

    it('displays error message', () => {
      render(<SolveButton {...base} error="操作失敗" />)
      expect(screen.getByText('操作失敗')).toBeInTheDocument()
    })

    it('calls onSolve on click', async () => {
      const user = userEvent.setup()
      render(<SolveButton {...base} />)
      await user.click(screen.getByRole('button'))
      expect(onSolve).toHaveBeenCalledOnce()
    })

    it('does not call onSolve when disabled', async () => {
      const user = userEvent.setup()
      render(<SolveButton {...base} isPending />)
      await user.click(screen.getByRole('button'))
      expect(onSolve).not.toHaveBeenCalled()
    })
  })

  describe('compact variant', () => {
    it('renders icon button when unsolved', () => {
      render(<SolveButton {...base} variant="compact" />)
      expect(screen.getByTitle('標記已解題')).toBeInTheDocument()
    })

    it('renders check icon when solved', () => {
      render(<SolveButton {...base} variant="compact" solvedAt="2026-01-01T00:00:00Z" />)
      expect(screen.getByTitle('已解題')).toBeInTheDocument()
    })

    it('disables button when pending', () => {
      render(<SolveButton {...base} variant="compact" isPending />)
      expect(screen.getByTitle('標記已解題')).toBeDisabled()
    })

    it('fires onSolve on click', async () => {
      const user = userEvent.setup()
      render(<SolveButton {...base} variant="compact" />)
      await user.click(screen.getByTitle('標記已解題'))
      expect(onSolve).toHaveBeenCalledOnce()
    })
  })
})
