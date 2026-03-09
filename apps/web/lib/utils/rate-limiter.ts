/**
 * Simple per-Vercel-instance rate limiter.
 *
 * State resets on cold starts (acceptable — provides DoS protection
 * within a single function instance lifetime). Does NOT require external
 * storage (Redis, KV) and works in serverless environments.
 *
 * Usage: place the check BEFORE expensive auth/DB operations.
 */

const _windows = new Map<string, { count: number; resetAt: number }>()

/**
 * Returns true if the request is allowed, false if the rate limit is exceeded.
 * @param ip       Client IP address (from x-forwarded-for)
 * @param limitPerMinute  Max requests allowed per IP per 60-second window
 */
export function checkRateLimit(ip: string, limitPerMinute = 120): boolean {
  const now = Date.now()
  const entry = _windows.get(ip)

  if (!entry || entry.resetAt < now) {
    _windows.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= limitPerMinute) {
    return false
  }

  entry.count++

  // Prune expired entries to prevent unbounded Map growth
  if (_windows.size > 10_000) {
    for (const [k, v] of _windows) {
      if (v.resetAt < now) _windows.delete(k)
    }
  }

  return true
}

/** Extract the real client IP from Next.js request headers. */
export function getClientIp(headers: { get(name: string): string | null }): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}
