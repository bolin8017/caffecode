# Worker Migration: Railway → Supabase pg_cron + Vercel API Route

**Date**: 2026-03-27
**Status**: Draft
**Branch**: `refactor/worker-pgcron-vercel`

## Summary

Migrate the push notification worker from Railway Cron (Node.js process) to a Vercel Serverless Function triggered by Supabase pg_cron + pg_net. Eliminates Railway dependency with zero additional cost — both Vercel and Supabase are already in use on free plans.

## Motivation

- Railway trial expired — can no longer deploy the worker
- Need a free, reliable cron trigger (GitHub Actions has 10–60 min delays; Cloudflare Workers free tier has 10ms CPU / 50 subrequest hard limits)
- Supabase pg_cron provides minute-level precision at the database layer
- Vercel serverless functions offer full Node.js with 300s timeout — no dependency restrictions

## Architecture

### Before (Railway)

```
Railway Cron (0 * * * *) → Node.js process → push logic → process.exit
```

### After (Supabase pg_cron + Vercel)

```
Supabase pg_cron (0 * * * *)
  → pg_net HTTP POST https://caffecode.net/api/cron/push
    → Vercel Serverless Function (Node.js, 300s timeout)
      → push logic (unchanged)
      → return Response.json({ ok, candidates, succeeded, failed })
```

## Detailed Design

### 1. New API Route

**File**: `apps/web/app/api/cron/push/route.ts`

Responsibilities:
1. Validate `Authorization: Bearer <CRON_SECRET>` header
2. Create per-invocation Supabase client (service_role)
3. Run 10-minute overlap guard (existing logic from `apps/worker/src/index.ts`)
4. Build channel registry (Telegram, LINE, Email)
5. Call `buildPushJobs()` from `apps/worker/src/workers/push.logic.ts`
6. Call `recordPushRun()` from `apps/worker/src/repositories/push.repository.ts`
7. Return JSON response with stats

The route imports worker modules directly — `push.logic.ts`, `push.repository.ts`, and channel classes are pure logic with injected SupabaseClient, no Node.js singletons.

**Import resolution**: The API route uses relative path imports (e.g., `../../../../apps/worker/src/workers/push.logic`) or a tsconfig path alias. Since `apps/worker/` is in the same monorepo, Next.js bundler (Turbopack) resolves these at build time. Alternatively, configure a `@worker/*` path alias in `apps/web/tsconfig.json` for cleaner imports.

### 2. Push Logic Adjustment (Catch-Up Model)

**Current**: `get_push_candidates()` only selects users where `push_hour_utc = current UTC hour`.

**New**: Select all users whose push hour has passed today but haven't been pushed yet:

```sql
push_hour_utc <= EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')
AND (last_push_date IS NULL OR last_push_date < CURRENT_DATE)
```

This ensures:
- Normal case: only current-hour users are selected (earlier hours already stamped)
- If pg_net trigger fails at 9:00, the 10:00 run catches up 9:00 + 10:00 users
- `stamp_last_push_date` + `history UNIQUE` constraint prevent duplicates

**Migration required**: Modify `get_push_candidates()` DB function.

### 3. Supabase pg_cron + pg_net Setup

**Extensions to enable**: `pg_cron`, `pg_net`

**Cron schedule SQL**:

```sql
select cron.schedule(
  'hourly-push-trigger',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://caffecode.net/api/cron/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cron_secret'
      )
    ),
    body := jsonb_build_object('triggered_at', now()),
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);
```

**Authentication**:
- Supabase Vault stores `cron_secret`
- pg_net sends it as `Authorization: Bearer <secret>` header
- Vercel env var `CRON_SECRET` holds the same value
- API route validates on every request

**pg_net behavior**: Fire-and-forget. Returns `request_id` immediately. Response stored in `net._http_response` (retained 6 hours). Timeout set to 120s to cover worst-case execution.

### 4. Dependency Changes

**`apps/web/package.json` — add**:
- `p-limit` — concurrency control (used by push.logic.ts)
- `@react-email/components` — email template components
- `@react-email/render` — email HTML rendering

**`apps/worker/package.json` — remove**:
- `@sentry/node` — dead code (no SENTRY_DSN ever configured)

**No changes to**: `packages/shared/`, `turbo.json`, existing test files.

### 5. What Stays the Same

- `apps/worker/src/workers/push.logic.ts` — core push logic, unchanged
- `apps/worker/src/repositories/push.repository.ts` — DB operations, unchanged
- `apps/worker/src/channels/` — Telegram, LINE, Email channel classes, unchanged
- `apps/worker/src/channels/email-template.tsx` — react-email template, unchanged (full Node.js on Vercel)
- `apps/worker/src/lib/logger.ts` — pino logger, works in Node.js serverless
- `packages/shared/` — completely untouched
- All 76 worker vitest tests — kept passing
- 10-minute overlap guard — preserved in API route

### 6. What Gets Removed

- `@sentry/node` dependency and all Sentry-related code in `apps/worker/src/index.ts`
- Railway deployment workflow (no more `railway up`)
- References to Railway in CLAUDE.md, CLAUDE.local.md, README.md

### 7. `apps/worker/` Directory

Kept for now. It holds the source-of-truth logic modules that the API route imports, plus 76 vitest tests. Future cleanup could move these modules to `packages/shared/`, but that's out of scope.

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| pg_net trigger failure (network/cold start) | Medium | Catch-up model: next hour compensates. Monitor via `push_runs` + `net._http_response` |
| pg_net no built-in retry | Low | Catch-up model makes single-hour misses recoverable |
| Vercel function timeout (300s) | Low | Worker typically runs 10–30s; p-limit(5) bounds concurrency |
| Unauthorized access to cron endpoint | Low | Bearer token auth via Supabase Vault + Vercel env var |

## Deployment Sequence

1. **DB migration first**: Modify `get_push_candidates()`, enable pg_cron/pg_net extensions, create cron schedule, store secret in Vault
2. **PR merge → Vercel auto-deploy**: New API route goes live
3. **Verify**: Check `push_runs` table after the next hour mark
4. **Decommission Railway**: Stop Railway service after confirming Vercel works

## Documentation Updates

- **CLAUDE.md**: Architecture table (Worker → Vercel Serverless + pg_cron trigger), Deployment table (remove Railway), Development Notes (remove Railway CLI)
- **CLAUDE.local.md**: Remove Railway CLI reference
- **README.md**: Update architecture description

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `CRON_SECRET` | Vercel env vars | Authenticate pg_cron trigger |
| `cron_secret` | Supabase Vault | Same value, sent by pg_net |
| `SUPABASE_URL` | Vercel env vars (existing) | Already present |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env vars (existing) | Already present |
| `TELEGRAM_BOT_TOKEN` | Vercel env vars (new) | Needed by push channel |
| `LINE_CHANNEL_ACCESS_TOKEN` | Vercel env vars (new) | Needed by push channel |
| `RESEND_API_KEY` | Vercel env vars (new) | Needed by email channel |
| `RESEND_FROM_EMAIL` | Vercel env vars (new) | Needed by email channel |
| `APP_URL` | Vercel env vars (new) | Used in push message links |
