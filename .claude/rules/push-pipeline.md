---
paths:
  - "apps/web/app/api/cron/push/**"
  - "packages/shared/src/push/**"
---

# Push Pipeline Patterns

The push pipeline lives in `packages/shared/src/push/`. It is invoked by `apps/web/app/api/cron/push/route.ts`, which Supabase `pg_cron` + `pg_net` POST to hourly.

## Push Pipeline

- **Broadcast-only scheduler**: scans `push_hour_utc = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')` — plain index hit, no per-row timezone math
- **`toUtcHour(localHour, timezone)`** in web `lib/utils/timezone.ts`: converts local push hour -> UTC at write time; called from `updatePushSettings` and `updateTimezone`
- **Batch queries**: `getVerifiedChannelsBulk` (single `.in()` query), `upsertHistoryBatch`, `advance_list_positions` RPC (single `jsonb_to_recordset()` UPDATE) — never query per-user in a loop
- **Parallel dispatch**: `Promise.allSettled` + `p-limit(5)`; fetch timeouts 15s (Telegram/LINE), 30s (Resend)
- **Circuit-breaker**: `consecutive_send_failures` counter increments on permanent failure (non-retryable: 400/401/403/422); channel paused at >= 3 failures, auto-recovers on next successful send. Channels are NOT deleted on failure.
- **Snapshot pagination**: `getAllCandidates()` fetches all eligible users at once via `get_push_candidates()` RPC, then slices into batches of 100 locally. Avoids offset-skip bug where stamping shrinks the live query between pages.
- **Inline batch dispatch**: `buildPushJobs` stamps + dispatches each 100-user batch before moving to the next. Bounds the undelivered window to one batch on crash.
- **At-least-once delivery**: `stamp_last_push_date()` marks users after successful dispatch per batch; `last_push_date` prevents re-delivery in subsequent runs. Concurrent invocations are bounded by the 10-minute overlap guard; the `history` UNIQUE constraint + `ignoreDuplicates` prevents duplicate DB records as a last line of defense.
- **List position indexing**: `sequence_number` starts at 1; `current_position` defaults to 0 (= "nothing sent yet"). Query: `sequence_number = current_position + 1`. After delivery: `current_position = sequence_number`.
- **List coverage invariant**: Every problem with content MUST belong to at least one curated list. `build_database.py` only imports list-referenced problems — orphans are invisible on the site.

## Cron Entry (apps/web/app/api/cron/push/route.ts)

- `export const dynamic = 'force-dynamic'` + `export const maxDuration = 300`
- Auth: `Authorization: Bearer ${CRON_SECRET}` verified with `timingSafeEqual` (see `isValidCronSecret`)
- 10-minute overlap guard: skips if another run completed in the last 10 minutes
- Calls `buildPushJobs(supabase, channelRegistry, dispatchLimit)` and `recordPushRun`

## Observability

- **Sentry**: `@sentry/nextjs`, no-op without `SENTRY_DSN`. Web uses `instrumentation.ts` hook.
- **Pino**: `apps/web/lib/logger.ts`; JSON in production, pino-pretty in dev.
- **Zod env**: `apps/web/lib/env.ts` validated at runtime via `instrumentation.ts` `register()` hook.

## Key Files

Push pipeline (`packages/shared/src/push/`):
- `push.logic.ts` — `buildPushJobs()` (pure, paginated), `dispatchJob()` (circuit-breaker)
- `push.repository.ts` — `getAllCandidates`, `getVerifiedChannelsBulk`, `upsertHistoryBatch`, `stampLastPushDate`, `incrementChannelFailures`, `resetChannelFailures`, `recordPushRun`
- `channels/` — `email-template.tsx`, `registry.ts` (defines `NotificationChannel` as a function type and `createChannelRegistry` that builds closures over `sendTelegramMessage` / `sendLineMessage` / `sendEmailMessage`)

Web cron endpoint (`apps/web/`):
- `app/api/cron/push/route.ts` — POST handler; auth; overlap guard; invokes shared pipeline
- `lib/supabase/server.ts` — `createServiceClient()` service_role client
- `lib/logger.ts` — Pino logger
- `lib/env.ts` — Zod env schema
