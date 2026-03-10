# Deployment

## Release & Deploy Workflow

All deployments follow this sequence. No exceptions.

1. Feature branch passes CI (build + lint + test)
2. PR reviewed and squash-merged into main
3. Web: Vercel auto-deploys from main (no manual action)
4. Worker: manually deploy via `railway up --detach` after verifying web is healthy
5. DB: migrations applied via Supabase CLI before deploying code that depends on them

## Deploy Checklist (for every production release)

- All tests pass locally: `pnpm test`
- CI pipeline green on the PR
- PR squash-merged into `main` (never direct push)
- **DB migrations first**: apply via `supabase db push` BEFORE deploying app code
- **Web**: Verify Vercel deployment succeeded (check deployment URL)
- **Worker**: Deploy with `railway up --detach`, then check `railway logs`
- **Post-deploy**: Verify `/api/health` returns OK; check admin dashboard for worker status

## Deploy Rules

- **Never** use `vercel --prod` — deploy web via git push only
- **Never** deploy worker before DB migrations are applied
- **Never** deploy directly from a feature branch to production
- **Railway env**: `APP_URL` must be `https://caffecode.net` (not Vercel preview URL)
- **Rollback**: Vercel instant rollback via dashboard; Railway via `railway up` with previous commit

## Cloud Services

| Service | Purpose | Required |
|---------|---------|----------|
| Vercel | Web hosting (Next.js) | Yes |
| Railway | Worker cron hosting | Yes |
| Supabase | PostgreSQL + Auth + RLS | Yes |
| GitHub | Repo + CI (Actions) | Yes |
| Telegram Bot API | Push notifications | Yes |
| LINE Messaging API | Push notifications | Yes |
| Resend | Email notifications | Yes |
| Cloudflare | DNS, SPF/DKIM/DMARC (for Resend) | Yes |
| Sentry | Error tracking | Optional (no-op without `SENTRY_DSN`) |
| PostHog | Product analytics | Optional (no-op without `NEXT_PUBLIC_POSTHOG_KEY`) |
