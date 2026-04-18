/**
 * Rate limiter for webhook and auth-callback endpoints.
 *
 * Two modes, auto-selected at module load:
 *
 * 1. **Upstash Redis** (preferred, production) — when both
 *    `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
 *    Sliding-window limit shared across every Vercel function instance
 *    and region. Set these via the Upstash marketplace integration in
 *    Vercel or `vercel env add`.
 *
 * 2. **In-memory Map fallback** — when Upstash env vars are absent
 *    (local dev, preview deploys without the integration, or incident
 *    recovery). Per-instance state; resets on cold start. The HMAC
 *    signature check remains the real auth, so this is defense-in-depth.
 *
 * The public API is `checkRateLimit(ip, limitPerMinute)` returning
 * `Promise<boolean>`. Callers `await` it identically in both modes.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const DEFAULT_LIMIT = 120
const WINDOW_MS = 60_000

// ── Upstash branch (only wired up when env vars are present) ──────────────

const hasUpstashEnv =
  typeof process.env.UPSTASH_REDIS_REST_URL === 'string'
  && process.env.UPSTASH_REDIS_REST_URL.length > 0
  && typeof process.env.UPSTASH_REDIS_REST_TOKEN === 'string'
  && process.env.UPSTASH_REDIS_REST_TOKEN.length > 0

const upstashRedis = hasUpstashEnv ? Redis.fromEnv() : null

// Cache ratelimit instances by limit-per-minute so the `checkRateLimit(ip, 30)`
// variant (auth callback) doesn't share state with the default webhook limit.
const ratelimitByLimit = new Map<number, Ratelimit>()

function getUpstashRatelimiter(limitPerMinute: number): Ratelimit | null {
  if (!upstashRedis) return null
  let rl = ratelimitByLimit.get(limitPerMinute)
  if (!rl) {
    rl = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(limitPerMinute, '1 m'),
      prefix: `caffecode:webhook:${limitPerMinute}`,
      analytics: false,
    })
    ratelimitByLimit.set(limitPerMinute, rl)
  }
  return rl
}

// ── In-memory fallback ──────────────────────────────────────────────────

const _windows = new Map<string, { count: number; resetAt: number }>()

function checkInMemory(ip: string, limitPerMinute: number): boolean {
  const now = Date.now()
  const entry = _windows.get(ip)

  if (!entry || entry.resetAt < now) {
    _windows.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (entry.count >= limitPerMinute) {
    return false
  }

  entry.count++

  // Prune expired entries to prevent unbounded Map growth.
  if (_windows.size > 10_000) {
    for (const [k, v] of _windows) {
      if (v.resetAt < now) _windows.delete(k)
    }
  }

  return true
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Returns `true` if the request from `ip` is allowed under the given
 * per-minute limit. Uses Upstash Redis when configured, otherwise an
 * in-memory sliding window.
 *
 * On an Upstash outage the helper falls back to the in-memory path so
 * webhook delivery is never blocked by a cache failure.
 */
export async function checkRateLimit(ip: string, limitPerMinute = DEFAULT_LIMIT): Promise<boolean> {
  const rl = getUpstashRatelimiter(limitPerMinute)
  if (rl) {
    try {
      const { success } = await rl.limit(ip)
      return success
    } catch {
      // Upstash unreachable — fall through to in-memory so webhooks keep flowing.
    }
  }
  return checkInMemory(ip, limitPerMinute)
}

/** Extract the real client IP from Next.js request headers. */
export function getClientIp(headers: { get(name: string): string | null }): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}
