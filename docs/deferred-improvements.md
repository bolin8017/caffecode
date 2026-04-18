# Deferred Improvements

This document tracks review follow-ups that were investigated but intentionally
deferred, along with the reasoning and the minimum work required to pick them up
later. Complements the merged PRs from the 2026-04-17 full-project review
(PRs #38–#49).

## Next.js 16 Cache Components adoption

**Status**: attempted, reverted. Tracked for a dedicated future PR.

**Goal**: replace `export const revalidate = 3600` on public pages with
`'use cache' + cacheLife + cacheTag`, enabling Partial Prerendering (PPR) and
targeted tag-based invalidation from admin mutations.

**Attempt**: branch `feat/next16-cache-components` set `cacheComponents: true`
in `next.config.ts` and migrated:

- `app/sitemap.ts` — fully cached (no user state).
- `app/(public)/lists/page.tsx` — extracted data fetch into a cached helper.
- `app/(public)/lists/[slug]/page.tsx` — `getListBySlug` + `getListProblems`
  as cached helpers; per-user progress stays dynamic in the page body.
- `app/(public)/problems/page.tsx` — catalog query cached; solved-IDs fetch
  stays dynamic.
- `app/(public)/problems/[slug]/page.tsx` — `getProblemBySlug` cached with
  `cacheTag('problems', 'problem:<slug>')`.
- `app/page.tsx` — made dynamic (auth-aware CTA).
- `app/api/{cron/push,health}/route.ts` — removed `dynamic = 'force-dynamic'`
  (incompatible with cacheComponents; defaults to dynamic).
- `lib/actions/admin.ts` — `deleteProblem` wired to
  `revalidateTag('problems', 'max')` + `revalidateTag('lists', 'max')`.

**Why reverted**: `next build` with `cacheComponents: true` enforces that
**every uncached data access must sit inside a `<Suspense>` boundary during
static generation**. Admin pages (each one fetches user-specific or live data)
and several public pages (per-user solved checkmarks, progress bar) fail the
build with errors like:

```
Route "/admin/channels": Uncached data was accessed outside of <Suspense>.
Route "/lists/[slug]": Uncached data was accessed outside of <Suspense>.
```

Making this work cleanly requires Suspense-wrapping every dynamic region on
every page that currently blends static and user-specific data — roughly
20+ files in `app/(admin)/**` plus the public routes that show solved status.
That exceeds what the original review item scoped and is a meaningful UI
refactor (streaming fallbacks, layout shifts, etc.) rather than a drop-in
migration.

**Resume checklist** when someone picks this up:

1. Re-apply the changes from the `feat/next16-cache-components` attempt as a
   starting point (see git history for the branch or this document's summary).
2. Audit each page under `app/(admin)/**` and `app/(public)/**`. For each
   Server Component that mixes cached and dynamic data, wrap the dynamic
   section in `<Suspense fallback={...}>` and move the dynamic fetch into the
   child component.
3. Design skeleton fallbacks consistent with the current layout to avoid
   perceived layout shift.
4. Verify `next build` with `cacheComponents: true` succeeds for every route.
5. Extend admin mutations to call `revalidateTag('problems'|'lists', 'max')`
   alongside the existing `revalidatePath` so updates propagate instantly.
6. Remove every remaining `export const revalidate` from app routes.

**Why this is worth revisiting**: when complete, content edits in the admin UI
show up on public pages within seconds instead of up to an hour, and static
shells render immediately while dynamic regions stream in — real UX win for
SEO-critical problem and list pages.

## Branded channel-identifier types

**Status**: deferred in PR #42. Low-value-per-effort.

**Goal**: prevent swapping a Telegram chat-id for a LINE user-id or an email
address at compile time by branding the `string` identifier type per channel.

**Why deferred**: would require threading branded types through every channel
call site across shared + web. With only three channel types and the bundled
push pipeline (PR #40) already failing loudly on mismatched registry entries,
the compile-time gain is narrow.

## Node 22 -> 24 LTS, pnpm 9 -> 10

**Status**: deferred in PR #43. Needs manual install + regression verification.

**Goal**: stay on current LTS (Vercel's default is Node 24 as of 2026-03).

**Resume checklist**:

1. Update `.nvmrc` and `.github/workflows/ci.yml` to `24`.
2. Bump `packageManager` in root `package.json` to `pnpm@10.x` and re-run
   `pnpm install` to regenerate the lockfile.
3. Full regression: `pnpm build`, `pnpm test`,
   `pnpm --filter @caffecode/web exec playwright test`.
4. Watch for pnpm 10 breaking changes (strict peer deps, different hoisting).
