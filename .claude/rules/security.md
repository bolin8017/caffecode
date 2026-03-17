# Security Patterns

- **CSP + security headers**: `next.config.ts` `headers()` — no `unsafe-eval`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), HSTS preload, Permissions-Policy, X-Permitted-Cross-Domain-Policies
- **Webhook verification**: Telegram `x-telegram-bot-api-secret-token` + LINE `X-Line-Signature` HMAC-SHA256, both with `crypto.timingSafeEqual()`. JSON parse try-catch + per-event error isolation.
- **Webhook rate limiting**: `lib/utils/rate-limiter.ts` — per-IP sliding window (120 req/min), module-level Map resets on Vercel cold start
- **Link token expiration**: `link_token_expires_at` on `notification_channels` — 30 min expiry. Strict RFC 4122 UUID regex validation in webhook handlers.
- **Timezone IANA validation**: `Intl.supportedValuesOf('timeZone')` whitelist via Zod schema in `lib/schemas/timezone.ts`
- **DB triggers**: `trg_restrict_user_update` locks `is_admin`, `line_push_allowed`, `last_push_date`. `trg_restrict_history_update` locks all except `solved_at` and `skipped_at`. service_role bypasses.
- **Open redirect prevention**: `sanitizeRedirect()` validates redirect param (must start with `/[a-z0-9]`, no backslashes)
- **PostgREST filter sanitization**: `sanitizeSearch()` strips commas, dots, parens, quotes from admin search input
- **Input validation**: All admin Server Actions validate with Zod (int/uuid); difficulty capped at 3000 with min<=max; topic_filter limited to 50
- **Error masking**: Server Actions log full Supabase errors server-side, return generic messages to clients
- **HTML escaping**: Telegram formatter escapes `&<>"` in problem titles (defense-in-depth)
- **RPC access control**: `advance_list_positions`, `get_push_candidates`, `stamp_last_push_date`, `increment_channel_failures`, `get_unsent_problem_ids_for_user` — EXECUTE revoked from PUBLIC/anon/authenticated, only service_role
- **Admin double guard**: Proxy route protection + per-action `is_admin` re-verification with proper `{ data, error }` destructuring
- **service_role key**: Required for all server-side DB access — anon denied by RLS
- **Account deletion**: GDPR/PDPA compliant — deletes auth user first (safe: if it fails, DB data intact), then DB row (cascades via FK)
- **Supabase error handling**: All repository and Server Action calls destructure `{ data, error }` and throw on error — no silent failures
- **API error truncation**: Shared channel senders truncate error bodies to 200 chars to prevent info leakage in logs
- Vercel Production Protection: **OFF** (webhooks must reach production)
