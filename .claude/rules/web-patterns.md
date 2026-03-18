---
paths:
  - "apps/web/**"
---

# Web App Patterns

## Data Access

- **Repository layer**: All DB queries in `lib/repositories/`; Server Actions never call `.from()` directly (exception: `exportData()` complex join + admin CRUD)
- **Supabase error handling**: Always destructure `{ data, error }` from `.rpc()` and `.from()`. Never `const { data } = ...` — it silently swallows failures.
- **Supabase RPC table functions**: `get_unsent_problem_ids_for_user` returns `TABLE(problem_id integer)` -> client gives `[{problem_id: N}]`, NOT `[N]`. Always map: `(data as {problem_id: number}[]).map(r => r.problem_id)`.
- **Supabase COUNT-only**: Use `.select('id', { count: 'exact', head: true })` with chained filters. Always select a single column (not `'*'`) with `head: true`.

## Auth & Proxy

- **x-user-profile header**: `proxy.ts` queries user profile once -> sets header -> `layout.tsx` reads it -> passes to `<Nav>`. Value is `encodeURIComponent(JSON.stringify({...}))` for ASCII-safe CJK names. Both `nav.tsx` and `admin/layout.tsx` consume this header.
- **revalidatePath caution**: Do NOT call from Server Actions that return data the caller displays (e.g. link tokens) — it wipes `useState` immediately.

## UI Patterns

- **Sticky bottom bar**: `ProblemActions` uses `IntersectionObserver` on sentinel div; when header action bar scrolls out, `fixed bottom-0` bar slides in via CSS `transition-all duration-200`. iOS safe area: `@utility pb-safe` in globals.css + `generateViewport({ viewportFit: 'cover' })`.

## Observability

- **Sentry**: `@sentry/nextjs`, no-op without `SENTRY_DSN`. Uses `instrumentation.ts` hook.
- **PostHog**: `posthog-js` client-side analytics, no-op without `NEXT_PUBLIC_POSTHOG_KEY`. `PostHogProvider` wraps app in `layout.tsx`.
- **Pino**: `lib/logger.ts`; JSON in production, pino-pretty in dev.
- **Zod env**: `lib/env.ts` schema validated at runtime via `instrumentation.ts` `register()` hook (safeParse — warns without crashing).

## Key Files

**Routes**:
- `app/page.tsx` — Landing page
- `app/(public)/` — /problems, /problems/[slug], /lists, /lists/[slug] (ISR `revalidate = 3600`)
- `app/robots.ts` — Dynamic robots.txt
- `app/(auth)/` — /dashboard, /settings, /settings/learning, /settings/account, /settings/notifications, /onboarding, /garden
- `app/(admin)/admin/` — Health dashboard, problems, content, lists, users, push monitor, channels
- `app/api/telegram/webhook/route.ts` — Telegram webhook handler
- `app/api/line/webhook/route.ts` — LINE webhook handler
- `app/api/health/route.ts` — Health check endpoint

**Core**:
- `proxy.ts` — Supabase auth token refresh (Next.js 16: exports `proxy` function)
- `instrumentation.ts` — Sentry init + env validation hook
- `next.config.ts` — `withSentryConfig`; image patterns, CSP + security headers
- `lib/auth.ts` — `getAuthUser()` returns `{ supabase, user }` or throws
- `lib/env.ts` — Zod server env validation
- `lib/sentry.ts`, `lib/posthog.ts` — Init helpers (no-op without keys)
- `lib/logger.ts` — Pino logger
- `lib/schemas/timezone.ts` — Shared Zod timezone schema (IANA whitelist)

**Data layer**:
- `lib/repositories/` — user, channel, history, list, garden, badge repositories
- `lib/services/streak.service.ts` — `calculateStreak()` consecutive solved days, timezone-aware
- `lib/utils/timezone.ts` — `toUtcHour()` pure function
- `lib/utils/rating-calibration.ts` — `computeSuggestedRange()` from feedback history
- `lib/utils/filter-url.ts` — `buildFilterUrl()` + `PAGE_SIZE` (50)
- `lib/utils/safe-redirect.ts` — `sanitizeRedirect()` blocks open redirect
- `lib/utils/sanitize-search.ts` — `sanitizeSearch()` strips PostgREST filter syntax
- `lib/utils/solve-result.ts` — `SolveResult` type, `buildSolveResult()`, `EMPTY_SOLVE_RESULT`

**Server Actions** (`lib/actions/`):
- `settings.ts` — Push settings, timezone, difficulty range, account deletion
- `onboarding.ts`, `notifications.ts`, `feedback.ts`
- `telegram.ts`, `line.ts`, `email.ts` — Channel connection flows
- `history.ts` — `markSolved()` returns `SolveResult`; TOCTOU guard, error masking, revalidates `/garden` and `/dashboard`
- `admin.ts` — Admin CRUD, forceNotifyAll, resetChannelFailures, testNotifyChannel, deleteUser

**Admin pages**:
- `admin/layout.tsx` — Grouped sidebar navigation (Monitoring / Content / Users)
- `admin/page.tsx` — Health dashboard (worker status, push success rate, failing channels)
- `admin/push/page.tsx` — Worker run history + 7-day delivery grid with status column
- `admin/push/force-notify-button.tsx` — Manual notify all with per-user result table
- `admin/channels/page.tsx` — Channel list with type/status filters, sortable columns
- `admin/channels/channel-actions.tsx` — Per-channel Reset (failure counter) + Test (send diagnostic)

**SEO**:
- `components/seo/json-ld.tsx` — Shared JSON-LD script renderer (Server Component)
- `lib/seo/schemas.ts` — Schema.org helpers (Organization, WebSite, BreadcrumbList, LearningResource, ItemList)
- `app/(public)/problems/[slug]/opengraph-image.tsx` — Dynamic OG image (Node.js runtime, Satori)
- `app/manifest.ts` — Web app manifest (MetadataRoute)

**Components**:
- `components/posthog-provider.tsx` — Client Component wrapping PostHog init
- `components/nav.tsx` — Server Component, reads `userProfile` prop (no DB query)
- `components/solve-button.tsx` — SolveButton with `variant` prop (default=full, compact=icon-only); controlled component
- `components/solve-feedback.tsx` — Decides toast (progress) vs modal (level-up/badge) based on `SolveResult`
- `components/solve-celebration-modal.tsx` — Level-up and badge celebration modal
- `components/data-table/` — SearchInput, FilterChips, SortableHeader, Pagination
- `app/(public)/problems/[slug]/problem-actions.tsx` — Action bar + sticky bottom bar + solve feedback
- `app/(auth)/dashboard/unsolved-queue.tsx` — Inline solve buttons with optimistic removal + solve feedback
