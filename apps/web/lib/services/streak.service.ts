/**
 * Calculate streak (consecutive days with at least one problem sent).
 * Uses the user's timezone for date grouping.
 */
export function calculateStreak(
  sentAts: { sent_at: string }[],
  timezone: string = 'Asia/Taipei'
): number {
  if (!sentAts.length) return 0

  // Group dates using user's timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const dates = [
    ...new Set(sentAts.map((s) => dateFormatter.format(new Date(s.sent_at)))),
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
      // Calculate previous day
      const d = new Date(date + 'T12:00:00Z') // noon to avoid DST edge cases
      d.setUTCDate(d.getUTCDate() - 1)
      expected = dateFormatter.format(d)
    } else {
      break
    }
  }

  return streak
}
