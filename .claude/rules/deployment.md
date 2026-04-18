# Deployment

## Release & Deploy Workflow

All deployments follow this sequence. No exceptions.

1. Feature branch passes CI (build + lint + test)
2. PR reviewed and squash-merged into main
3. Web (including the `/api/cron/push` route) Vercel auto-deploys from main — no manual action
4. DB: migrations applied via Supabase CLI before deploying code that depends on them

## Deploy Checklist (for every production release)

- All tests pass locally: `pnpm test`
- CI pipeline green on the PR
- PR squash-merged into `main` (never direct push)
- **DB migrations first**: apply via `supabase db push` BEFORE deploying app code
- **Web**: Verify Vercel deployment succeeded (check deployment URL)
- **Post-deploy**: Verify `/api/health` returns OK; check admin dashboard for cron run status (shown as "Worker 狀態" in the UI for historical reasons)

## Deploy Rules

- **Never** use `vercel --prod` — deploy web via git push only
- **Never** deploy code that depends on new DB migrations before migrations are applied
- **Never** deploy directly from a feature branch to production
- **Rollback**: Vercel instant rollback via dashboard

## Cron Entry

The push pipeline runs as a Vercel serverless function at `/api/cron/push`, triggered hourly by Supabase `pg_cron` + `pg_net`. (Previously a standalone `apps/worker/` Node process; merged into the web app in PR #33.)

- Auth: `CRON_SECRET` Bearer token (Supabase Vault + Vercel env var)
- Catch-up model: `push_hour_utc <= current_hour` recovers missed triggers
- 10-minute overlap guard prevents duplicate runs
- Monitor: admin push dashboard shows `push_runs` history

## Cloud Services

| Service | Purpose | Required |
|---------|---------|----------|
| Vercel | Web + cron route hosting (Next.js) | Yes |
| Supabase | PostgreSQL + Auth + RLS + pg_cron | Yes |
| GitHub | Repo + CI (Actions) | Yes |
| Telegram Bot API | Push notifications | Yes |
| LINE Messaging API | Push notifications | Yes |
| Resend | Email notifications | Yes |
| Cloudflare | DNS, SPF/DKIM/DMARC (for Resend) | Yes |
| Upstash Redis | Cross-instance webhook rate limiter | Optional — in-memory Map fallback per function instance when env vars unset. `UPSTASH_REDIS_REST_URL/TOKEN` or `KV_REST_API_URL/TOKEN` from the Vercel Marketplace integration. |
| Sentry | Error tracking | Optional (no-op without `SENTRY_DSN`) |
| PostHog | Product analytics | Optional (no-op without `NEXT_PUBLIC_POSTHOG_KEY`) |
