/**
 * Calculate streak (consecutive days with at least one problem solved).
 * Uses the user's timezone for date grouping.
 */
export function calculateStreak(
  solvedRows: { solved_at: string }[],
  timezone: string = 'Asia/Taipei'
): number {
  if (!solvedRows.length) return 0

  // Group dates using user's timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const dates = [
    ...new Set(solvedRows.map((s) => dateFormatter.format(new Date(s.solved_at)))),
  ]
    .sort()
    .reverse()

  // Today in user's timezone
  const today = dateFormatter.format(new Date())

  let streak = 0
  let expected = today

  for (const date of dates) {
    if (date === expected) {
      streak++
      // Calculate previous calendar date arithmetically (no UTC/timezone pitfalls)
      const [y, m, d] = date.split('-').map(Number)
      const prev = new Date(y, m - 1, d - 1) // JS Date handles month/year rollover
      expected = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
    } else {
      break
    }
  }

  return streak
}
