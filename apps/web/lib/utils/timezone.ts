/**
 * Convert a local push hour to UTC hour for the given IANA timezone.
 * Pre-computing this at write time lets the worker use a plain integer
 * index scan instead of per-row timezone arithmetic at query time.
 *
 * Uses Intl hour extraction — server-timezone-independent and no string
 * parsing. Half-hour offsets (India UTC+5:30, etc.) are floored because
 * pushes run hourly and a 30-min skew is within one window.
 */
export function toUtcHour(localHour: number, timezone: string): number {
  const now = new Date()
  // Extract current hour in target timezone (hour12:false → "00"–"23"; % 24 handles edge-case "24")
  const localHourNow = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }).format(now),
    10
  ) % 24
  const utcHourNow = now.getUTCHours()
  // How many whole hours ahead of UTC is this timezone right now
  const offsetHours = ((localHourNow - utcHourNow) + 24) % 24
  return ((localHour - offsetHours) + 24) % 24
}
