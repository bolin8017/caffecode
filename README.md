<p align="center">
  <strong>CaffeCode</strong><br>
  每天一杯咖啡配一道題，把刷題變成習慣，輕鬆備好技術面試。
</p>

<p align="center">
  <a href="https://github.com/bolin8017/caffecode/actions/workflows/ci.yml"><img src="https://github.com/bolin8017/caffecode/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://caffecode.net"><img src="https://img.shields.io/badge/website-caffecode.net-blue" alt="Website"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/bolin8017/caffecode" alt="License"></a>
</p>

<p align="center">
  <a href="https://caffecode.net">Website</a> ·
  <a href="https://t.me/CaffeCodeBot">Telegram Bot</a> ·
  <a href="https://line.me/R/ti/p/@624yzmrd">LINE Bot</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

A daily LeetCode problem delivery platform with AI-generated C++ explanations in Traditional Chinese. Browse curated problem lists on the web, connect Telegram / LINE / Email, and receive a personalized problem every day at your preferred time.

## Features

- **32 curated lists** — Blind 75, NeetCode 150, Grind 75, company lists (FAANG, Google, Meta, Amazon, Apple, Bloomberg, Microsoft), topic & algorithm lists
- **451+ problems** with AI-generated content — explanation, C++ solution, complexity analysis, pseudocode, alternative approaches, follow-up questions
- **Automated metadata sync** — `sync_leetcode.py` fetches all ~3100 free LeetCode problems via GraphQL API + contest ratings
- **Zero runtime LLM calls** — all content pre-generated offline via Claude Sonnet
- **3 notification channels** — Telegram, LINE, Email; connect any combination
- **2 delivery modes** — follow a list sequentially, or filter by difficulty rating + topic
- **Per-user push hour** — configurable delivery time in your local timezone
- **Feedback & calibration** — rate difficulty & content quality; system suggests optimal difficulty range
- **Solve tracking** — mark problems as solved from web or Telegram inline button; requires feedback first (anti-abuse)
- **Coffee Garden** — `/garden` gamification page: each LeetCode topic maps to a coffee variety with 5 growth stages based on solve count
- **Streak tracking** — timezone-aware daily streak on dashboard
- **Admin monitoring** — health dashboard, worker run history, per-channel test/reset
- **SEO-optimized** — server-rendered public pages with dynamic sitemap

## Architecture

```
                  ┌──────────────────────────┐
                  │   Supabase (PostgreSQL)  │
                  │   Auth · RLS · RPC       │
                  └──────┬──────────┬────────┘
                         │          │
              ┌──────────┘          └──────────┐
              │                                │
   ┌──────────┴──────────┐          ┌──────────┴──────────┐
   │   Next.js 16 Web    │          │   Railway Worker    │
   │   (Vercel)          │          │   (Cron — hourly)   │
   │                     │          │                     │
   │  Public pages (SEO) │          │  Candidate scan     │
   │  OAuth (GitHub/     │          │  Problem selection  │
   │    Google)          │          │  Channel dispatch   │
   │  Dashboard/Settings │          │  Circuit-breaker    │
   │  Admin monitoring   │          │                     │
   └─────────────────────┘          └─────────────────────┘
              │                                │
              └────────────┬───────────────────┘
                           │
                ┌──────────┴──────────┐
                │  packages/shared    │
                │                     │
                │  Channel senders    │
                │  Problem selection  │
                │  Notification fmt   │
                └─────────────────────┘
```

Two processes share the same Supabase database. `packages/shared` provides channel send functions, problem selection logic, and notification formatters used by both.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Auth | Supabase Auth (GitHub + Google OAuth) |
| Database | Supabase PostgreSQL — RLS, RPC functions, service_role access |
| Worker | Node.js, Railway Cron (hourly) |
| Notifications | Telegram Bot API, LINE Messaging API, Resend (React Email) |
| Shared | `@caffecode/shared` — channel senders, problem selection, formatters |
| Monorepo | pnpm workspaces + Turborepo |
| Observability | Sentry (errors), PostHog (analytics), Pino (structured logging) |
| Security | CSP headers, Zod validation, webhook HMAC verification |
| Testing | Vitest (173 TS tests) + pytest (20 Python tests) |
| CI/CD | GitHub Actions, Vercel (web), Railway (worker) |

## Project Structure

```
apps/
  web/              Next.js 16 — public pages, auth, dashboard, settings, admin
  worker/           Railway Cron — hourly push delivery with circuit-breaker
packages/
  shared/           Channel senders, problem selection, notification formatters
supabase/
  config.toml       Supabase CLI configuration
docs/
  supabase-schema.sql   Full schema reference
  staging-setup.md      Staging environment guide
  content-spec.md       Content generation specification
scripts/
  sync_leetcode.py      Fetch LeetCode metadata into data/problems/ (GraphQL + ratings)
  build_database.py     Data importer for lists and problems (skips metadata-only)
  ipv4-only.cjs         Forces IPv4 for local dev on WSL2
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+ (repo uses `packageManager: "pnpm@9.15.0"`)
- A [Supabase](https://supabase.com) project

### Installation

```bash
git clone https://github.com/bolin8017/caffecode.git
cd caffecode
pnpm install
```

### Environment Variables

Copy and fill in the env files:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env
```

See each `.env.example` for required variables. `SUPABASE_SERVICE_ROLE_KEY` must be the **service_role** key — anon is denied by RLS.

### Database Setup

1. Create a [Supabase](https://supabase.com) project.
2. Run [`docs/supabase-schema.sql`](docs/supabase-schema.sql) in the SQL editor to create all tables, indexes, RLS policies, and RPC functions.
3. Apply migrations from `supabase/migrations/` if needed.
4. Sync LeetCode problem metadata and import content:

```bash
# Fetch all problem metadata (titles, difficulty, ratings, topics)
python3 scripts/sync_leetcode.py                   # full sync (~3100 free problems)
python3 scripts/sync_leetcode.py --dry-run         # preview without writing
python3 scripts/sync_leetcode.py --ids 1,42,200    # sync specific problems only

# Import problems WITH content into Supabase (metadata-only files are skipped)
python3 scripts/build_database.py --list blind75   # single list
python3 scripts/build_database.py --list all       # all lists
```

### Development

```bash
pnpm build          # shared → worker → web (Turborepo manages order)
pnpm dev            # start web dev server on localhost:3000
```

> **WSL2 note**: Dev scripts preload `scripts/ipv4-only.cjs` to force IPv4 DNS resolution. WSL2 lacks IPv6, and Node.js fetch tries IPv6 first (Happy Eyeballs), causing external API calls to fail. Production is unaffected.

### Running Tests

```bash
# All TypeScript tests via Turborepo
pnpm test

# Individually
cd packages/shared && pnpm exec vitest run   # 68 tests
cd apps/worker && pnpm exec vitest run       # 45 tests
cd apps/web && pnpm exec vitest run          # 60 tests

# Python tests (sync script)
cd scripts && python3 -m pytest tests/ -v    # 20 tests
```

## Deployment

| Target | Platform | Method | Config |
|--------|----------|--------|--------|
| Web | Vercel | `git push origin main` | GitHub integration |
| Worker | Railway | `railway up --detach` | [`railway.toml`](railway.toml), cron `0 * * * *` |

Set environment variables from each `.env.example` in the respective platform dashboard.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

[AGPL-3.0](LICENSE)
