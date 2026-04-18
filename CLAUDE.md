# CaffeCode — Project Notes

## Brand

**CaffeCode** — 每天一杯咖啡配一道題，把刷題變成習慣，輕鬆備好技術面試。

- Production: `https://caffecode.net` (canonical; also `caffecode.vercel.app`)
- GitHub: `bolin8017/caffecode`
- Telegram: `@CaffeCodeBot`
- LINE: `@624yzmrd`

## Architecture

pnpm monorepo + Turborepo. Single Next.js app + shared library share a Supabase database:

| Component | Location | Runtime | Role |
|-----------|----------|---------|------|
| Web | `apps/web/` | Next.js 16 on Vercel | Public pages (SEO), OAuth, dashboard, settings, admin, `/api/cron/push` entry |
| Shared | `packages/shared/` | TypeScript library | Types, channel senders, problem selection, formatters, push pipeline |

Historically there was also `apps/worker/` running a separate Node process; it was merged into the web app's `/api/cron/push` route in PR #33 and the package deleted.

**Push cron**: `apps/web/app/api/cron/push/route.ts` is the live cron entry. Supabase `pg_cron` + `pg_net` POST hourly with `Authorization: Bearer <CRON_SECRET>`.

**Pre-curated content model**: All problem content generated offline via admin UI. Zero runtime LLM calls.

**Content**: 45 curated lists, 810 problems with AI-generated content. Data files in `data/` (not in git). New problems via `scripts/sync_leetcode.py`, content generated offline, imported via `scripts/build_database.py`.

## Git Conventions

Follows Conventional Commits 1.0.0 (Google/Angular style). Full format in `.claude/rules/git-conventions.md`.

- Branch: `<type>/<short-kebab-description>`
- Commit: `<type>(<scope>): <subject>` — imperative, lowercase, no period, max 50 chars
- Scopes: `web`, `shared`, `db`, `ci`
- PR → squash merge → delete branch. Never push to `main`.
- Update `CLAUDE.md` and `README.md` before every PR if the change affects them.

## Database

Schema in `docs/supabase-schema.sql`. All tables have RLS enabled.

| Table | Purpose |
|-------|---------|
| `problems` | leetcode_id, title, slug, difficulty, rating, topics |
| `curated_lists` | Named lists with type (classic/official/company/topic/algorithm/difficulty/challenge) |
| `list_problems` | List ↔ problem ordering (sequence_number) |
| `problem_content` | AI content per problem (UNIQUE per problem_id); avg_score, score_count |
| `users` | Auth profile: timezone, push settings, push_hour_utc, difficulty range, topic filter, line_push_allowed |
| `notification_channels` | channel_type, channel_identifier, is_verified, consecutive_send_failures, link_token_expires_at |
| `user_list_progress` | Per-user list tracking (current_position, is_active); exactly one active list per user |
| `history` | user_id × problem_id delivery record; UNIQUE constraint; skipped_at for dismissed items |
| `push_runs` | Per-worker-run stats: candidates, succeeded, failed, duration_ms, error_msg |
| `feedback` | Difficulty feeling + content_score (1-5) per user per problem |
| `badges` | Badge definitions: slug, name, icon, category, requirement JSONB |
| `user_badges` | User x badge junction (earned_at); auto-awarded on solve |

**Rating range**: Data spans 1074–2452; DB defaults 0/3000 = "no filter"; slider UI 1000–2600.

## Deployment

| Target | Platform | Deploy method |
|--------|----------|---------------|
| Web (includes cron API route) | Vercel | `git push origin main` (auto-deploy) |

- DB migrations via Supabase MCP `apply_migration` BEFORE deploying code that depends on them
- Never `vercel --prod` — deploy web via git push only
- Cron entry: Supabase `pg_cron` fires `pg_net` HTTP POST to `/api/cron/push` every hour
- Auth: `CRON_SECRET` Bearer token (Supabase Vault + Vercel env var)
- Catch-up model: missed cron triggers recovered on the next successful run
- Full checklist and cloud services in `.claude/rules/deployment.md`

## Notification Channels

- Telegram: `@CaffeCodeBot`, webhook `/api/telegram/webhook`
- LINE: `@624yzmrd`, webhook `/api/line/webhook`, 200 msg/month free tier
- Email: Resend via `caffecode.net`, from `CaffeCode <noreply@caffecode.net>`

## Supabase

- Auth Site URL: `https://caffecode.net`
- Redirect URLs: `https://caffecode.net/**`, `http://localhost:3000/**`
- OAuth: GitHub + Google
- Migrations: `supabase/migrations/`, apply via Supabase MCP `apply_migration`
- Schema reference: `docs/supabase-schema.sql`

## Development Notes

**Toolchain**: Node 24 LTS, pnpm 10.33.0 (set via `packageManager` — corepack auto-switches). `engines.node >=22.0.0` so contributors on Node 22 can still develop; CI and Vercel use 24.

**Tests**: 757 TypeScript vitest (shared 186, web 571) + 57 Playwright E2E + 54 Python. Vitest: `pnpm exec vitest run` per package. E2E: `pnpm exec playwright test` in `apps/web/` (requires dev server running). Python: `cd scripts && python3 -m pytest tests/ -v`.

**Coverage**: `pnpm test:coverage` runs all packages with `@vitest/coverage-v8`. CI enforces thresholds (shared 95/90/95/95, web 90/85/90/90 for stmts/branch/funcs/lines). Coverage scope: business logic only (`lib/`, `src/`, API routes); excludes components, pages, and infra singletons.

**Next.js 16 + Cache Components**: `cacheComponents: true` enabled. Every runtime data read (`cookies()`, `headers()`, awaited params/searchParams, Supabase auth) sits inside a `<Suspense>` boundary; shared fetches use `'use cache'` + `cacheTag(...)`; admin mutations invalidate via `revalidateTag(..., 'max')`. `proxy.ts` (not `middleware.ts`); export must be named `proxy`. Full pattern in `.claude/rules/web-patterns.md`.

**No git worktrees**: `.env.local` not shared across worktrees. Use `git checkout <branch>`.

**WSL2**: `scripts/ipv4-only.cjs` preloaded in dev for IPv4-first DNS (WSL2 has no IPv6).

**vitest**: `apps/web` tests outside `src/` need explicit include in `vitest.config.ts`.

**Build order**: `packages/shared` must build before `apps/web` — `main: "dist/index.js"`.

**Admin pages**: Event handlers cannot be in Server Components — use Client Component wrappers.

**Cron push**: `pg_cron` (Supabase) fires `pg_net` HTTP POST to `/api/cron/push` hourly. Auth via `CRON_SECRET` Bearer token, verified with `timingSafeEqual`. Exact-hour model: `push_hour_utc = current_hour`.
