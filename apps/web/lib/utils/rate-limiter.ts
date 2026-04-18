/**
 * Rate limiter for webhook and auth-callback endpoints.
 *
 * Two modes, auto-selected at module load:
 *
 * 1. **Upstash Redis** (preferred, production) — sliding-window limit
 *    shared across every Vercel function instance and region. Two env-var
 *    schemes are accepted so either Vercel Marketplace integration works
 *    without config:
 *
 *    - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 *      (installed via the "Upstash for Redis" marketplace integration)
 *    - `KV_REST_API_URL` + `KV_REST_API_TOKEN`
 *      (installed via the "Upstash KV" marketplace integration, a rename
 *      of the legacy Vercel KV product)
 *
 * 2. **In-memory Map fallback** — when neither scheme is set (local dev,
 *    preview deploys without the integration, or incident recovery).
 *    Per-instance state; resets on cold start. The HMAC signature check
 *    remains the real auth, so this is defense-in-depth.
 *
 * The public API is `checkRateLimit(ip, limitPerMinute)` returning
 * `Promise<boolean>`. Callers `await` it identically in both modes.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

const DEFAULT_LIMIT = 120
const WINDOW_MS = 60_000

// ── Upstash branch (only wired up when env vars are present) ──────────────

function resolveUpstashCreds(): { url: string; token: string } | null {
  // Prefer the Upstash-native names when both are present.
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (upstashUrl && upstashToken) return { url: upstashUrl, token: upstashToken }

  // Fall back to the KV-flavoured names from the "Upstash KV" integration.
  const kvUrl = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN
  if (kvUrl && kvToken) return { url: kvUrl, token: kvToken }

  return null
}

// `new Redis({ url, token })` validates the URL synchronously and will throw
// on a typo (e.g. after `vercel env add`). Catch at module load so the route
// keeps working on the in-memory fallback instead of crashing every cold start.
let upstashRedis: Redis | null = null
const upstashCreds = resolveUpstashCreds()
if (upstashCreds) {
  try {
    upstashRedis = new Redis({ url: upstashCreds.url, token: upstashCreds.token })
  } catch (err) {
    logger.error(
      { err },
      'rate-limiter: Upstash env vars are set but Redis constructor failed; falling back to in-memory',
    )
    upstashRedis = null
  }
}

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
    } catch (err) {
      // Upstash unreachable — log once per request and fall through to
      // in-memory so webhooks keep flowing through the incident.
      logger.warn({ err, ip }, 'rate-limiter: Upstash call failed, falling back to in-memory')
    }
  }
  return checkInMemory(ip, limitPerMinute)
}

/** Extract the real client IP from Next.js request headers. */
export function getClientIp(headers: { get(name: string): string | null }): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}
