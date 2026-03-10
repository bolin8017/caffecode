// apps/worker/src/__tests__/email-template.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import { createElement } from 'react'
import { DailyProblemEmail } from '../channels/email-template.js'

async function renderEmail(props: {
  title: string
  difficulty: string
  leetcodeId: number
  problemUrl: string
}) {
  return render(createElement(DailyProblemEmail, props))
}

describe('DailyProblemEmail', () => {
  it('renders Easy difficulty with green color (#22c55e)', async () => {
    const html = await renderEmail({
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcodeId: 1,
      problemUrl: 'https://caffecode.net/problems/two-sum',
    })

    expect(html).toContain('#22c55e')
    expect(html).toContain('Easy')
  })

  it('renders Medium difficulty with orange color (#f97316)', async () => {
    const html = await renderEmail({
      title: 'Add Two Numbers',
      difficulty: 'Medium',
      leetcodeId: 2,
      problemUrl: 'https://caffecode.net/problems/add-two-numbers',
    })

    expect(html).toContain('#f97316')
    expect(html).toContain('Medium')
  })

  it('renders Hard difficulty with red color (#ef4444)', async () => {
    const html = await renderEmail({
      title: 'Median of Two Sorted Arrays',
      difficulty: 'Hard',
      leetcodeId: 4,
      problemUrl: 'https://caffecode.net/problems/median-of-two-sorted-arrays',
    })

    expect(html).toContain('#ef4444')
    expect(html).toContain('Hard')
  })

  it('includes title, leetcode ID, and problem URL in rendered output', async () => {
    const html = await renderEmail({
      title: 'Two Sum',
      difficulty: 'Easy',
      leetcodeId: 1,
      problemUrl: 'https://caffecode.net/problems/two-sum',
    })

    expect(html).toContain('Two Sum')
    // React Email renders `#{leetcodeId}` as '#<!-- -->1' (comment between # and number)
    expect(html).toMatch(/#.*1/)
    expect(html).toContain('https://caffecode.net/problems/two-sum')
  })
})
