# Staging Environment Setup

## Overview

Staging mirrors production with isolated data. Both components (web + worker cron) deploy to Vercel; database needs a separate Supabase project.

## 1. Database (Supabase)

1. Create a new Supabase project (e.g., `caffecode-staging`)
2. Apply all migrations: `npx supabase db push --project-ref <staging-ref>`
3. Import seed data: `python3 scripts/build_database.py --list all` (with staging env vars)
4. Enable `pg_cron` and `pg_net` extensions
5. Store `CRON_SECRET` in Supabase Vault
6. Schedule cron: same SQL as production but with staging `APP_URL`
7. Note the staging URL and keys

## 2. Web + Worker (Vercel)

Vercel creates Preview Deployments automatically for non-main branches. The push worker runs as `/api/cron/push` within the same deployment.

For a fixed staging URL:
1. Create a `staging` branch: `git checkout -b staging && git push -u origin staging`
2. In Vercel Dashboard > Settings > Domains: assign `staging.caffecode.net` to the `staging` branch
3. Set staging env vars in Vercel (Project Settings > Environment Variables > Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` — staging Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — staging anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — staging service role key
   - `CRON_SECRET` — must match Supabase Vault value
   - `APP_URL` — `https://staging.caffecode.net`
   - Channel tokens (can reuse dev bot tokens)

## 3. Deployment Workflow

```
feature branch --> PR --> staging branch (manual merge) --> test --> main (production)
```

- Push to `staging` branch triggers Vercel Preview deployment
- Push to `main` branch triggers Vercel Production deployment
- pg_cron triggers `/api/cron/push` hourly on both staging and production

## 4. Environment Matrix

| Component | Production | Staging |
|-----------|-----------|---------|
| Web + Worker URL | caffecode.net | staging.caffecode.net |
| DB | (production project) | (to be created) |
| Cron trigger | pg_cron → production URL | pg_cron → staging URL |
| Telegram | @CaffeCodeBot | @CaffeCodeDevBot |
