# CaffeCode — Project Notes

## Brand

**CaffeCode** — 每天一杯咖啡配一道題，把刷題變成習慣，輕鬆備好技術面試。

- Production: `https://caffecode.net` (canonical; also `caffecode.vercel.app`)
- GitHub: `bolin8017/caffecode`
- Telegram: `@CaffeCodeBot`
- LINE: `@624yzmrd`

## Architecture

pnpm monorepo + Turborepo. Two processes share a single Supabase database:

| Component | Location | Runtime | Role |
|-----------|----------|---------|------|
| Web | `apps/web/` | Next.js 16 on Vercel | Public pages (SEO), OAuth, dashboard, settings, admin |
| Worker | `apps/worker/` | Node.js on Railway Cron (hourly) | Candidate scan → problem selection → channel dispatch |
| Shared | `packages/shared/` | TypeScript library | Types, channel senders, problem selection, formatters |

**Pre-curated content model**: All problem content (explanation, C++ solution, complexity analysis, pseudocode, alternatives, follow-up) is generated offline via admin UI. Zero runtime LLM calls.

**Content**: 45 curated lists, 810 problems with AI-generated content. Data files stored locally (not in git). New problems discovered via `scripts/sync_leetcode.py` (metadata), content generated offline via Claude Sonnet, imported to Supabase via `scripts/build_database.py` (skips metadata-only files).

## Git Conventions (Google / Angular Style)

All contributors (including AI agents) MUST follow these rules exactly.

### Branch Naming

Format: `<type>/<short-kebab-description>`

```
feat/dark-mode-toggle         # New feature
fix/duplicate-push-on-crash   # Bug fix
refactor/extract-channel-send # Code restructuring (no behavior change)
docs/add-contributing-guide   # Documentation only
chore/upgrade-dependencies    # Maintenance (CI, deps, config)
test/add-webhook-tests        # Test additions or fixes
perf/batch-channel-queries    # Performance improvement
```

### Commit Message Format

Follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/) (Google/Angular convention).

```
<type>(<scope>): <subject>
                                    ← blank line
[optional body]                     ← explain WHY, not WHAT
                                    ← blank line
[optional footer(s)]                ← BREAKING CHANGE, Closes #issue
```

#### Header (`<type>(<scope>): <subject>`)

| Element | Rule |
|---------|------|
| **type** | Required. One of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `build`, `style` |
| **scope** | Optional but recommended. One of: `web`, `worker`, `shared`, `db`, `ci`. Omit only for cross-cutting changes |
| **subject** | Required. Imperative mood ("add", not "added"/"adds"). Lowercase. No period. Max 50 chars (hard limit 72) |

**Type definitions**:
- `feat` — new feature visible to users (triggers minor version bump)
- `fix` — bug fix (triggers patch version bump)
- `refactor` — code change that neither fixes a bug nor adds a feature
- `docs` — documentation only (README, CLAUDE.md, comments, JSDoc)
- `test` — adding or correcting tests
- `chore` — maintenance tasks (deps, config, scripts)
- `perf` — performance improvement with no functional change
- `ci` — CI/CD pipeline changes (GitHub Actions, deployment config)
- `build` — build system changes (turbo, tsconfig, package.json)
- `style` — formatting, whitespace, semicolons (no logic change)

#### Body

- Wrap at 72 characters per line
- Explain the motivation for the change and contrast with previous behavior
- Use when the subject line alone is not sufficient

#### Footer

- `BREAKING CHANGE: <description>` — triggers major version bump
- `Closes #<issue-number>` — auto-close linked issue
- `Co-Authored-By: Name <email>` — credit co-authors

#### Examples

```
feat(web): add dark mode toggle to settings page

Users requested a dark mode option. Implemented using CSS custom
properties to avoid runtime theme switching overhead.

Closes #42
```

```
fix(worker): prevent duplicate push when worker crashes mid-batch

stamp_last_push_date() now runs before dispatch instead of after,
ensuring at-most-once delivery even on crash.
```

```
refactor(shared): extract channel send logic to shared package

Both worker and admin were duplicating ~120 lines of send logic.
Moved to packages/shared to maintain a single source of truth.
```

```
ci: add type checking step to CI pipeline
```

```
docs: update README with badges and contribution guide
```

### Commit Discipline

- **One logical change per commit** — never mix unrelated changes (e.g. a bug fix and a refactor)
- **Atomic commits** — each commit should build and pass tests independently
- **No "fix typo" chains** — squash trivial fixes into the relevant commit before PR (use `git rebase -i`)

### PR Workflow

1. Create feature branch from `main` using naming convention above
2. Make small, focused commits following the format above
3. Open PR → CI must pass → reviewer approves → **squash merge** into `main`
4. Branch auto-deleted after merge

### PR Description Format

Squash merge produces one commit on `main` — the PR title becomes the commit subject, the PR body becomes the commit body. Both must follow the same Conventional Commits format defined above.

| Element | Rule |
|---------|------|
| **Title** | `<type>(<scope>): <subject>` — same format as commit header |
| **Body** | `## Summary` (concise bullet points of what changed and why) + `## Test plan` (verified items as plain text statements) |
| **Test plan** | Only list items that have been verified. Never use unchecked checkboxes (`- [ ]`) or TODO items |

### Documentation Maintenance

Every feature branch must update documentation before opening a PR:

- **`CLAUDE.md`** — update Key Files, Key Patterns, Database, or Development Notes if the change adds/removes files, tables, patterns, or conventions
- **`README.md`** — update Features, test counts, or any user-facing description that changed

Include these doc updates as a `docs:` commit in the same feature branch — do NOT create a separate branch for docs.

### Hard Rules

- **Never** push directly to `main` — always use PRs
- **Squash merge only** — keeps `main` history clean (one PR = one commit on main)
- **Delete branch** after merge (GitHub auto-delete enabled)
- **No force push** to `main` under any circumstances
- **No `--no-verify`** — if a hook fails, fix the issue, don't skip it

## Key Patterns

### Push Pipeline

- **Broadcast-only scheduler**: Worker scans `push_hour_utc = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')` — plain index hit, no per-row timezone math
- **`toUtcHour(localHour, timezone)`** in `lib/utils/timezone.ts`: converts local push hour → UTC at write time via `Intl.DateTimeFormat`; called from `updatePushSettings` and `updateTimezone`
- **Batch queries**: `getVerifiedChannelsBulk` (single `.in()` query), `upsertHistoryBatch`, `advance_list_positions` RPC (single `jsonb_to_recordset()` UPDATE) — never query per-user in a loop
- **Parallel dispatch**: `Promise.allSettled` + `p-limit(5)`; fetch timeouts 15s (Telegram/LINE), 30s (Resend)
- **Circuit-breaker**: `consecutive_send_failures` counter increments on permanent failure (400/403); channel paused at >= 3 failures, auto-recovers on next successful send (counter resets to 0). Channels are NOT deleted on failure.
- **Cursor-based pagination**: `getPushCandidatesBatch()` processes 100 candidates at a time via `.range()`
- **At-most-once guard**: `stamp_last_push_date()` marks users before dispatch; `last_push_date` prevents re-delivery on worker crash/retry
- **List position indexing**: `sequence_number` starts at 1; `current_position` defaults to 0 (= "nothing sent yet"). Query: `sequence_number = current_position + 1`. After delivery: `current_position = sequence_number`.
- **List coverage invariant**: Every problem with content MUST belong to at least one curated list. `build_database.py` only imports list-referenced problems — orphans are invisible on the site. When adding new problems, create or expand topic lists to maintain zero orphans. Use `scripts/generate_topic_lists.py` to verify coverage.

### Web Patterns

- **Repository layer**: All DB queries in `lib/repositories/` (web) and `src/repositories/` (worker); Server Actions never call `.from()` directly (exception: `exportData()` complex join + admin CRUD)
- **x-user-profile header**: `proxy.ts` queries user profile once → sets header → `layout.tsx` reads it → passes to `<Nav>`. Value is `encodeURIComponent(JSON.stringify({...}))` for ASCII-safe CJK names. Both `nav.tsx` and `admin/layout.tsx` consume this header.
- **Supabase error handling**: Always destructure `{ data, error }` from `.rpc()` and `.from()`. Never `const { data } = ...` — it silently swallows failures.
- **Supabase RPC table functions**: `get_unsent_problem_ids_for_user` returns `TABLE(problem_id integer)` → client gives `[{problem_id: N}]`, NOT `[N]`. Always map: `(data as {problem_id: number}[]).map(r => r.problem_id)`.
- **Supabase COUNT-only**: Use `.select('id', { count: 'exact', head: true })` with chained filters for admin dashboard stats. Always select a single column (not `'*'`) with `head: true` to avoid fetching unnecessary data.
- **revalidatePath caution**: Do NOT call from Server Actions that return data the caller displays (e.g. link tokens) — it wipes `useState` immediately.
- **Sticky bottom bar pattern**: `ProblemActions` uses `IntersectionObserver` on a sentinel div; when header action bar scrolls out, `fixed bottom-0` bar slides in via CSS `transition-all duration-200`. iOS safe area handled via `@utility pb-safe` in globals.css + `generateViewport({ viewportFit: 'cover' })` in layout.tsx.

### Shared Package

- `packages/shared/src/channels/` — `sendTelegramMessage`, `sendLineMessage`, `sendEmailMessage` return `SendResult` with `shouldRetry`. Worker channel classes delegate here; admin `forceNotifyAll` calls directly.
- `packages/shared/src/services/problem-selector.ts` — `selectProblemForUser()` single source of truth for both worker and admin.
- `packages/shared/src/services/badge-checker.ts` — `evaluateBadgeCondition()` evaluates badge requirement JSONB against user context.
- `packages/shared/src/utils/notification-formatters.ts` — `formatTelegramMessage`, `buildFlexBubble`, `formatEmailSubject`, `buildTelegramReplyMarkup`.
- `packages/shared/src/types/push.ts` — `PushMessage`, `SendResult`, `SelectedProblem`, `Difficulty` type used by worker and shared channels.
- `packages/shared/src/repositories/problem.repository.ts` — `getListProblemAtPosition`, `getProblemAtListPosition`, `getUnsentProblemIds`, `getProblemById`. Internal to `problem-selector.ts`; not part of the shared public API.
- `packages/shared/src/utils/topic-utils.ts` — `topicLabel()`, `topicToVariety()`, `normalizeTopics()`, `TOPIC_ALIASES`. Kebab-case topic slug utilities. `normalizeTopics` merges aliases and re-sorts by `solved_count DESC`.
- `apps/web/lib/repositories/garden.repository.ts` — `computeLevel()`, `toStage()`, `getTopicProficiency()`, `getGardenSummary()`.
- **Build requirement**: `main: "dist/index.js"` in package.json — Railway runtime needs compiled output.

### Observability

- **Sentry**: `@sentry/nextjs` (web) + `@sentry/node` (worker). No-op without `SENTRY_DSN`. Web uses `instrumentation.ts` hook; worker inits at top of `src/index.ts`.
- **PostHog**: `posthog-js` client-side analytics. No-op without `NEXT_PUBLIC_POSTHOG_KEY`. `PostHogProvider` wraps app in `layout.tsx`.
- **Pino structured logging**: `lib/logger.ts` (web) + `src/lib/logger.ts` (worker); JSON in production, pino-pretty in dev.
- **Zod env validation**: Worker `src/lib/config.ts` parses at startup (fail-fast). Web `lib/env.ts` schema validated at runtime via `instrumentation.ts` `register()` hook (safeParse — warns without crashing).

### Security

- **CSP + security headers**: Configured in `next.config.ts` `headers()` — Content-Security-Policy (no `unsafe-eval`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`), X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), Strict-Transport-Security (HSTS preload), Permissions-Policy, X-Permitted-Cross-Domain-Policies
- **Webhook verification**: Telegram uses `x-telegram-bot-api-secret-token` with `crypto.timingSafeEqual()`; LINE uses `X-Line-Signature` HMAC-SHA256 with `crypto.timingSafeEqual()`. Both webhooks validate JSON payloads with try-catch and per-event error isolation.
- **Webhook rate limiting**: `lib/utils/rate-limiter.ts` — per-IP sliding window (120 req/min), module-level Map resets on Vercel cold start. Applied to `/api/telegram/webhook` and `/api/line/webhook` before secret validation.
- **Link token expiration**: `link_token_expires_at` column on `notification_channels` — tokens expire 30 minutes after creation. Verification checks expiry and clears token on success.
- **Link token validation**: Strict RFC 4122 UUID regex (`[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}`) in both Telegram and LINE webhook handlers, preventing injection of arbitrary strings.
- **Timezone IANA validation**: `Intl.supportedValuesOf('timeZone')` whitelist via shared Zod schema in `lib/schemas/timezone.ts`, used by `settings.ts` and `onboarding.ts`.
- **DB column triggers**: `trg_restrict_user_update` locks `is_admin`, `line_push_allowed`, `last_push_date` on `users` table (service_role bypassed for worker/admin writes). `trg_restrict_history_update` raises exception if anything other than `solved_at` is modified on `history`.
- **Open redirect prevention**: `sanitizeRedirect()` in OAuth callback validates redirect parameter (must start with `/[a-z0-9]`, no backslashes)
- **PostgREST filter sanitization**: `sanitizeSearch()` strips commas, dots, parens, quotes from admin search input to prevent `.or()` injection
- **Input validation**: All admin Server Actions validate parameters with Zod (int/uuid); difficulty range capped at 3000 with min<=max cross-validation; topic_filter limited to 50 elements
- **Error masking**: Server Actions log full Supabase errors server-side, return generic messages to clients
- **HTML escaping**: Telegram formatter escapes `&<>"` in problem titles (defense-in-depth)
- **RPC access control**: `advance_list_positions` EXECUTE revoked from PUBLIC/anon/authenticated — only callable by service_role (worker).
- **Admin double guard**: Proxy route protection + per-action `is_admin` re-verification with proper `{ data, error }` destructuring
- **service_role key**: Required for all server-side DB access — anon is denied by RLS
- **Account deletion**: GDPR/PDPA compliant — deletes auth user first (safe: if it fails, DB data intact), then DB row (cascades via FK). Both `deleteAccount()` and admin `deleteUser()` follow this order.
- **Supabase error handling**: All repository and Server Action Supabase calls destructure `{ data, error }` and throw on error — no silent failures
- **API error truncation**: Shared channel senders truncate error response bodies to 200 chars to prevent info leakage in logs
- **Worker safety limit**: `MAX_BATCHES=100` in `buildPushJobs` prevents unbounded pagination loops
- Vercel Production Protection: **OFF** (webhooks must reach production)

## Key Files

### Web (`apps/web/`)

**Routes**:
- `app/page.tsx` — Landing page
- `app/(public)/` — /problems, /problems/[slug], /lists, /lists/[slug] (all use `revalidate = 3600` ISR)
- `app/robots.ts` — Dynamic robots.txt generation
- `app/(auth)/` — /dashboard, /settings, /settings/learning, /settings/account, /settings/notifications, /onboarding, /garden
- `app/(admin)/admin/` — Health dashboard, problems, content, lists, users, push monitor, channels
- `app/api/telegram/webhook/route.ts` — Telegram webhook handler
- `app/api/line/webhook/route.ts` — LINE webhook handler
- `app/api/health/route.ts` — Health check endpoint (uptime monitoring)

**Core**:
- `proxy.ts` — Supabase auth token refresh (Next.js 16: renamed from `middleware.ts`, exports `proxy` function)
- `instrumentation.ts` — Sentry initialization + env validation hook
- `next.config.ts` — Wrapped with `withSentryConfig`; image remote patterns, CSP + security headers
- `lib/auth.ts` — `getAuthUser()` returns `{ supabase, user }` or throws
- `lib/env.ts` — Zod schema for server env validation
- `lib/sentry.ts` — Sentry init helper (no-op without DSN)
- `lib/posthog.ts` — PostHog init helper (no-op without key)
- `lib/logger.ts` — Pino logger
- `lib/schemas/timezone.ts` — Shared Zod timezone schema (IANA whitelist)

**Data layer**:
- `lib/repositories/` — `user.repository.ts`, `channel.repository.ts`, `history.repository.ts`, `list.repository.ts`, `garden.repository.ts`, `badge.repository.ts`
- `lib/services/streak.service.ts` — `calculateStreak()` counts consecutive solved days (not push days), timezone-aware with pure calendar arithmetic
- `lib/utils/timezone.ts` — `toUtcHour()` pure function
- `lib/utils/rating-calibration.ts` — `computeSuggestedRange()` from feedback history
- `lib/utils/filter-url.ts` — `buildFilterUrl()` URL utility + `PAGE_SIZE` constant (50)
- `lib/utils/safe-redirect.ts` — `sanitizeRedirect()` blocks open redirect via `//`, `\`, non-path values
- `lib/utils/sanitize-search.ts` — `sanitizeSearch()` strips PostgREST filter syntax from admin search input
- `lib/utils/solve-result.ts` — `SolveResult` type, `buildSolveResult()` pure function, `EMPTY_SOLVE_RESULT` constant

**Server Actions** (`lib/actions/`):
- `settings.ts` — Push settings, timezone, difficulty range, account deletion
- `onboarding.ts`, `notifications.ts`, `feedback.ts`
- `telegram.ts`, `line.ts`, `email.ts` — Channel connection flows
- `history.ts` — `markSolved()` returns `SolveResult` (level-ups, badges, progress); TOCTOU guard, error masking, revalidates `/garden` and `/dashboard`
- `admin.ts` — Admin CRUD, forceNotifyAll (returns per-user results), resetChannelFailures, testNotifyChannel, deleteUser

**Admin pages**:
- `admin/layout.tsx` — Grouped sidebar navigation (Monitoring / Content / Users)
- `admin/page.tsx` — Health-focused dashboard (worker status, push success rate, failing channels)
- `admin/push/page.tsx` — Worker run history table + 7-day delivery grid with status column
- `admin/push/force-notify-button.tsx` — Manual notify all with per-user result table
- `admin/channels/page.tsx` — Channel list with type/status filters, sortable columns
- `admin/channels/channel-actions.tsx` — Per-channel Reset (failure counter) + Test (send diagnostic notification)

**Components**:
- `components/posthog-provider.tsx` — Client Component wrapping PostHog init
- `components/nav.tsx` — Server Component, reads `userProfile` prop (no DB query)
- `components/user-menu.tsx` — Avatar dropdown
- `components/settings-nav.tsx` — Settings navigation
- `components/solve-button.tsx` — Shared SolveButton with `variant` prop (default=full button, compact=icon-only); controlled component (parent owns solve state)
- `components/solve-feedback.tsx` — Decides toast (progress) vs modal (level-up/badge) based on `SolveResult`
- `components/solve-celebration-modal.tsx` — Level-up and badge celebration modal with garden navigation
- `components/data-table/` — Shared filter/pagination: `SearchInput`, `FilterChips`, `SortableHeader`, `Pagination`
- `app/(public)/problems/[slug]/problem-actions.tsx` — Client Component: header action bar + sticky bottom bar + IntersectionObserver + solve feedback
- `app/(auth)/dashboard/unsolved-queue.tsx` — Client Component: inline solve buttons with optimistic removal + solve feedback

### Worker (`apps/worker/`)

- `src/index.ts` — Entry point: Sentry init, buildPushJobs, Promise.allSettled dispatch, recordPushRun
- `src/workers/push.logic.ts` — `buildPushJobs()` (pure, paginated), `dispatchJob()` (circuit-breaker)
- `src/channels/` — `index.ts` (channel interface + registry), `telegram.ts`, `line.ts`, `email.ts`
- `src/repositories/push.repository.ts` — `getPushCandidatesBatch`, `getVerifiedChannelsBulk`, `upsertHistoryBatch`, `stampLastPushDate`, `incrementChannelFailures`, `resetChannelFailures`, `recordPushRun`
- `src/lib/config.ts` + `config.schema.ts` — Zod-validated env; `config` exported everywhere
- `src/lib/logger.ts` — Pino logger
- `src/lib/supabase.ts` — service_role client

### Data & Scripts

- `data/` — **Not tracked in git** (in `.gitignore`). Contains 45 list definitions and problem JSON files. Imported into Supabase via `build_database.py`.
- `data/sync-report.json` — Generated by `sync_leetcode.py`; tracks which problems have content vs metadata-only
- `scripts/sync_leetcode.py` — Fetches all LeetCode problem metadata via GraphQL API + zerotrac contest ratings into `data/problems/*.json`. Merges metadata while preserving existing AI content fields. Skips paid-only problems. Usage: `python3 scripts/sync_leetcode.py [--dry-run] [--ids 1,42,200]`
- `scripts/generate_topic_lists.py` — Assigns orphan problems (with content but not in any list) to topic-based curated lists. Cross-lists by topic match. Usage: `python3 scripts/generate_topic_lists.py [--dry-run]`
- `scripts/build_database.py` — Multi-list importer (`--list {slug}`); reads `apps/web/.env.local`. Skips metadata-only problems (those without any of the 6 content fields)
- `scripts/tests/test_sync_leetcode.py` — 20 pytest tests for sync script utilities
- `scripts/ipv4-only.cjs` — Preload script forcing IPv4 for local dev on WSL2 (loaded via `NODE_OPTIONS` in dev scripts)

### Config & CI

- `turbo.json` — Build tasks, env var declarations
- `railway.toml` — Worker build/deploy/cron config
- `.github/workflows/ci.yml` — Build + type check + lint + test (shared, worker, web)
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template
- `.github/ISSUE_TEMPLATE/` — Bug report + feature request templates
- `.github/CODEOWNERS` — Code ownership for PR reviews
- `CONTRIBUTING.md` — Contribution guidelines (branch, commit, PR workflow)
- `CODE_OF_CONDUCT.md` — Contributor Covenant
- `supabase/config.toml` — Supabase CLI config (project ref)

## Database

Schema in `docs/supabase-schema.sql`. All tables have RLS enabled.

| Table | Purpose |
|-------|---------|
| `problems` | leetcode_id, title, slug, difficulty, rating, topics |
| `curated_lists` | Named lists with type (classic/official/company/topic/algorithm/difficulty/challenge) |
| `list_problems` | List ↔ problem ordering (sequence_number) |
| `problem_content` | AI content per problem (UNIQUE per problem_id); avg_score, score_count |
| `users` | Auth profile: timezone, push settings, push_hour_utc, difficulty range, topic filter, line_push_allowed |
| `notification_channels` | channel_type (telegram/line/email), channel_identifier, is_verified, consecutive_send_failures, link_token_expires_at |
| `user_list_progress` | Per-user list tracking (current_position, is_active); exactly one active list per user |
| `history` | user_id × problem_id delivery record; UNIQUE constraint |
| `push_runs` | Per-worker-run stats: candidates, succeeded, failed, duration_ms, error_msg |
| `feedback` | Difficulty feeling + content_score (1-5) per user per problem |
| `badges` | Badge definitions: slug, name, icon, category, requirement JSONB |
| `user_badges` | User x badge junction (earned_at); auto-awarded on solve |

**DB functions**:
- `get_push_candidates()` — Users eligible for push in current UTC hour (no-param only)
- `get_unsent_problem_ids_for_user(UUID, diff_min, diff_max, topic[])` — Filter mode selection
- `advance_list_positions(jsonb)` — Batch UPDATE of current_position via `jsonb_to_recordset()`
- `stamp_last_push_date(UUID[])` — Mark batch of users as delivered today
- `get_topic_proficiency(UUID)` — Per-topic solve stats for coffee garden (unnest topics aggregation); includes `auth.uid()` defense-in-depth check

**Rating range**: Data spans 1074–2452; DB defaults 0/3000 = "no filter"; slider UI 1000–2600.

## Deployment

| Target | Platform | Deploy method | Config |
|--------|----------|---------------|--------|
| Web | Vercel (`caffecode`) | `git push origin main` | GitHub integration |
| Worker | Railway | `railway up --detach` | `railway.toml`, cron `0 * * * *` |

### Release & Deploy Workflow

All deployments follow this sequence. No exceptions.

```
1. Feature branch passes CI (build + lint + test)
2. PR reviewed and squash-merged into main
3. Web: Vercel auto-deploys from main (no manual action)
4. Worker: manually deploy via `railway up --detach` after verifying web is healthy
5. DB: migrations applied via Supabase CLI before deploying code that depends on them
```

### Deploy Checklist (for every production release)

- [ ] All tests pass locally: `pnpm test`
- [ ] CI pipeline green on the PR
- [ ] PR squash-merged into `main` (never direct push)
- [ ] **DB migrations first**: If the release includes schema changes, apply migrations via `supabase db push` BEFORE deploying app code
- [ ] **Web**: Verify Vercel deployment succeeded (check deployment URL)
- [ ] **Worker**: Deploy with `railway up --detach`, then check logs with `railway logs`
- [ ] **Post-deploy**: Verify `/api/health` returns OK; check admin dashboard for worker status

### Deploy Rules

- **Never** use `vercel --prod` — deploy web via git push only
- **Never** deploy worker before DB migrations are applied
- **Never** deploy directly from a feature branch to production
- **Railway env**: `APP_URL` must be `https://caffecode.net` (not Vercel preview URL)
- **Rollback**: Vercel supports instant rollback via dashboard; Railway via `railway up` with previous commit

### Cloud Services

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

## Development Notes

**Tests**: 236 TypeScript (shared 67, worker 40, web 129) + 20 Python (sync script). TS tests: `pnpm exec vitest run` inside each package dir. Python tests: `cd scripts && python3 -m pytest tests/ -v`. CI runs TS tests via `pnpm --filter @caffecode/{shared,worker,web} test`.

**vitest config**: `apps/web` tests outside `src/` (e.g. `lib/__tests__/`) need explicit include in `vitest.config.ts`.

**Next.js 16**: `proxy.ts` (not `middleware.ts`); export must be named `proxy`.

**Admin pages**: Event handlers cannot be in Server Components — use Client Component wrappers.

**Branching workflow**: Do NOT use git worktrees. This project relies on `.env.local` (untracked) which worktrees don't share, causing dev server failures. Always use `git checkout <branch>` to switch branches in the main repo. When running feature work, create a feature branch and work directly in it — never use `--isolation worktree` or `EnterWorktree`.

**WSL2 IPv4 workaround**: `scripts/ipv4-only.cjs` is preloaded in dev scripts via `NODE_OPTIONS='--require=...'`. WSL2 has no IPv6 connectivity, and Node.js fetch (undici) uses Happy Eyeballs which tries IPv6 first → fails on Telegram API. The preload sets `dns.setDefaultResultOrder('ipv4first')` + `net.setDefaultAutoSelectFamily(false)`. Only affects `pnpm dev`; production builds are unaffected.

## Notification Channels

### Telegram

- Production: `@CaffeCodeBot` → webhook `https://caffecode.net/api/telegram/webhook`
- Dev: `@CaffeCodeDevBot` (token in `.env.local`)
- Local testing: cloudflared tunnel → setWebhook

### LINE

- Official account: `@624yzmrd`
- Webhook: `https://caffecode.net/api/line/webhook`
- Free tier: 200 msg/month → `line_push_allowed` admin flag gates access (~6 users)
- Env var pitfall: Use `printf` not `echo` when piping to `vercel env add` (trailing newline)

### Email

- Resend domain: `caffecode.net` (Cloudflare DNS, verified SPF/DKIM/DMARC)
- From: `CaffeCode <noreply@caffecode.net>`
- Worker renders React Email HTML; admin sends plain text

## Supabase

- Auth Site URL: `https://caffecode.net`
- Redirect URLs: `https://caffecode.net/**`, `http://localhost:3000/**`
- OAuth: GitHub + Google (`caffecode-oauth` GCP project)
- Schema: `docs/supabase-schema.sql` (full schema reference; new environments run this to set up)
- New migrations: create in `supabase/migrations/` and apply via Supabase MCP `apply_migration`
- Schema reference: `docs/supabase-schema.sql`
