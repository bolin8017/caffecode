---
paths:
  - "apps/worker/**"
  - "packages/shared/src/push/**"
---

# Worker Patterns

## Push Pipeline

- **Broadcast-only scheduler**: Worker scans `push_hour_utc = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')` — plain index hit, no per-row timezone math
- **`toUtcHour(localHour, timezone)`** in web `lib/utils/timezone.ts`: converts local push hour -> UTC at write time; called from `updatePushSettings` and `updateTimezone`
- **Batch queries**: `getVerifiedChannelsBulk` (single `.in()` query), `upsertHistoryBatch`, `advance_list_positions` RPC (single `jsonb_to_recordset()` UPDATE) — never query per-user in a loop
- **Parallel dispatch**: `Promise.allSettled` + `p-limit(5)`; fetch timeouts 15s (Telegram/LINE), 30s (Resend)
- **Circuit-breaker**: `consecutive_send_failures` counter increments on permanent failure (non-retryable: 400/401/403/422); channel paused at >= 3 failures, auto-recovers on next successful send. Channels are NOT deleted on failure.
- **Snapshot pagination**: `getAllCandidates()` fetches all eligible users at once via `get_push_candidates()` RPC, then slices into batches of 100 locally. Avoids offset-skip bug where stamping shrinks the live query between pages.
- **Inline batch dispatch**: `buildPushJobs` stamps + dispatches each 100-user batch before moving to the next. Bounds the undelivered window to one batch on crash.
- **At-least-once delivery**: `stamp_last_push_date()` marks users after successful dispatch per batch; `last_push_date` prevents re-delivery in subsequent runs. Note: concurrent worker instances can cause duplicate delivery within the same run (no distributed lock). The `history` UNIQUE constraint + `ignoreDuplicates` prevents duplicate DB records.
- **List position indexing**: `sequence_number` starts at 1; `current_position` defaults to 0 (= "nothing sent yet"). Query: `sequence_number = current_position + 1`. After delivery: `current_position = sequence_number`.
- **List coverage invariant**: Every problem with content MUST belong to at least one curated list. `build_database.py` only imports list-referenced problems — orphans are invisible on the site.

## Observability

- **Sentry**: `@sentry/node`, no-op without `SENTRY_DSN`. Inits at top of `src/index.ts`.
- **Pino**: `src/lib/logger.ts`; JSON in production, pino-pretty in dev.
- **Zod env**: `src/lib/config.ts` parses at startup (fail-fast).

## Key Files

Push pipeline lives in `packages/shared/src/push/` (shared between web API route and worker):
- `push.logic.ts` — `buildPushJobs()` (pure, paginated), `dispatchJob()` (circuit-breaker)
- `push.repository.ts` — `getAllCandidates`, `getVerifiedChannelsBulk`, `upsertHistoryBatch`, `stampLastPushDate`, `incrementChannelFailures`, `resetChannelFailuresForUsers`, `recordPushRun`
- `channels/` — `interface.ts`, `telegram.ts`, `line.ts`, `email.ts`, `email-template.tsx`, `registry.ts` (`createChannelRegistry` factory)

Worker entry point (`apps/worker/src/`):
- `index.ts` — Entry point: imports `buildPushJobs`, `recordPushRun`, `createChannelRegistry` from `@caffecode/shared`
- `lib/config.ts` + `config.schema.ts` — Zod-validated env
- `lib/logger.ts` — Pino logger
- `lib/supabase.ts` — service_role client
