# Staging Environment Setup

## Overview

Staging mirrors production with isolated data. All three components need separate staging instances.

## 1. Database (Supabase)

1. Create a new Supabase project (e.g., `caffecode-staging`)
2. Apply all migrations: `npx supabase db push --project-ref <staging-ref>`
3. Import seed data: `python3 scripts/build_database.py --list all` (with staging env vars)
4. Note the staging URL and keys

## 2. Web (Vercel)

Vercel creates Preview Deployments automatically for non-main branches.

For a fixed staging URL:
1. Create a `staging` branch: `git checkout -b staging && git push -u origin staging`
2. In Vercel Dashboard > Settings > Domains: assign `staging.caffecode.net` to the `staging` branch
3. Set staging env vars in Vercel (Project Settings > Environment Variables > Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` - staging Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - staging anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - staging service role key
   - Other vars as needed

## 3. Worker (Railway)

1. Create a staging environment: `railway environment create staging`
2. Link to staging: `railway link --environment staging`
3. Set staging env vars:
   - `SUPABASE_URL` - staging Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` - staging service role key
   - `APP_URL` - `https://staging.caffecode.net`
   - Channel tokens (can reuse dev bot tokens)
4. Deploy: `railway up --detach`

## 4. Deployment Workflow

```
feature branch --> PR --> staging branch (manual merge) --> test --> main (production)
```

- Push to `staging` branch triggers Vercel Preview + Railway staging deploy
- Push to `main` branch triggers Vercel Production + Railway production deploy

## 5. Environment Matrix

| Component | Production | Staging |
|-----------|-----------|---------|
| Web URL | caffecode.net | staging.caffecode.net |
| DB | (production project) | (to be created) |
| Worker | Railway prod env | Railway staging env |
| Telegram | @CaffeCodeBot | @CaffeCodeDevBot |
