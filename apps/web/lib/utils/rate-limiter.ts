/**
 * Simple per-instance rate limiter for webhook endpoints.
 *
 * State resets on cold starts and does not share across Vercel function
 * instances — it's best-effort protection, not a hard guarantee. In practice
 * that's fine here because the real authentication for each webhook is
 * HMAC-based (Telegram `x-telegram-bot-api-secret-token` / LINE `X-Line-Signature`),
 * verified with `timingSafeEqual`. The rate limiter is a second line of defense:
 * it cheaply absorbs bursts before we spend CPU on signature verification or DB.
 *
 * If webhook traffic grows beyond the single-instance budget, swap the
 * `_windows` Map for a shared store (Upstash Redis, Vercel Runtime Cache).
 * Keep the function signature identical so call sites don't change.
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
