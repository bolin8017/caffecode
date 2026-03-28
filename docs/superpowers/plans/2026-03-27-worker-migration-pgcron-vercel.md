# Worker Migration: Railway → pg_cron + Vercel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Railway cron worker with a Vercel API route triggered by Supabase pg_cron + pg_net.

**Architecture:** Supabase `pg_cron` fires hourly → `pg_net` HTTP POST to `/api/cron/push` → Vercel serverless function runs the existing push logic (unchanged). Catch-up model ensures missed hours are recovered automatically.

**Tech Stack:** Next.js API route, Supabase pg_cron/pg_net/Vault, existing worker modules (push.logic.ts, push.repository.ts, channels).

**Spec:** `docs/superpowers/specs/2026-03-27-worker-migration-pgcron-vercel-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web/app/api/cron/push/route.ts` | API route: auth, overlap guard, build channels, run push, respond |
| Create | `apps/web/__tests__/api/cron/push/route.test.ts` | Unit tests for the API route |
| Create | `supabase/migrations/20260327000001_push_candidates_catchup.sql` | Modify `get_push_candidates()` to catch-up model |
| Create | `supabase/migrations/20260327000002_enable_pgcron_pgnet.sql` | Enable pg_cron + pg_net extensions, schedule job |
| Modify | `apps/worker/src/index.ts` | Remove Sentry imports and code |
| Modify | `apps/worker/src/workers/push.logic.ts` | Remove Sentry breadcrumb code |
| Modify | `apps/worker/package.json` | Remove `@sentry/node` dependency |
| Modify | `apps/web/package.json` | Add `@react-email/components`, `@react-email/render` |
| Modify | `CLAUDE.md` | Update architecture, deployment, test counts |
| Modify | `CLAUDE.local.md` | Remove Railway CLI reference |
| Modify | `README.md` | Update architecture description |

---

### Task 1: Modify `get_push_candidates()` to catch-up model

**Files:**
- Create: `supabase/migrations/20260327000001_push_candidates_catchup.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Catch-up model: select all users whose push hour has passed today
-- but haven't been pushed yet. If a cron trigger is missed at hour N,
-- the next successful trigger at hour N+1 picks up both batches.

CREATE OR REPLACE FUNCTION get_push_candidates()
RETURNS TABLE (
    id               UUID,
    timezone         TEXT,
    active_mode      TEXT,
    difficulty_min   INT,
    difficulty_max   INT,
    topic_filter     TEXT[],
    line_push_allowed BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, timezone, active_mode, difficulty_min, difficulty_max, topic_filter, line_push_allowed
    FROM users
    WHERE push_enabled = true
      AND onboarding_completed = true
      AND push_hour_utc <= EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::int
      AND (
          last_push_date IS NULL
          OR last_push_date < (NOW() AT TIME ZONE COALESCE(timezone, 'Asia/Taipei'))::DATE
      );
$$;
```

Key change: `push_hour_utc =` becomes `push_hour_utc <=`. Users whose hour already passed today but weren't stamped are included.

- [ ] **Step 2: Apply the migration**

Use Supabase MCP `apply_migration` tool with name `push_candidates_catchup` and the SQL above.

- [ ] **Step 3: Verify the migration**

```bash
cd /home/bolin8017/Documents/repositories/caffecode
# Check the function definition
# Via Supabase MCP execute_sql:
# SELECT prosrc FROM pg_proc WHERE proname = 'get_push_candidates';
```

Verify the function body contains `push_hour_utc <=` instead of `push_hour_utc =`.

- [ ] **Step 4: Commit**

```bash
git checkout -b refactor/worker-pgcron-vercel
git add supabase/migrations/20260327000001_push_candidates_catchup.sql
git commit -m "refactor(db): change get_push_candidates to catch-up model

push_hour_utc <= current_hour (was =). If a cron trigger is missed,
the next successful run picks up all overdue users automatically."
```

---

### Task 2: Remove Sentry from worker

**Files:**
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/workers/push.logic.ts`
- Modify: `apps/worker/package.json`

- [ ] **Step 1: Remove Sentry from index.ts**

In `apps/worker/src/index.ts`, remove:
- `import * as Sentry from '@sentry/node'` (line 2)
- The `if (config.SENTRY_DSN)` Sentry.init block (lines 10-15)
- The `if (config.SENTRY_DSN)` block in the `.catch()` handler (lines 75-78)

The file should look like:

```typescript
import { config } from './lib/config.js'
import pLimit from 'p-limit'
import { logger } from './lib/logger.js'
import { supabase } from './lib/supabase.js'
import { channelRegistry } from './channels/registry.js'
import { buildPushJobs } from './workers/push.logic.js'
import { recordPushRun } from './repositories/push.repository.js'

const dispatchLimit = pLimit(5)

async function main() {
  const startMs = Date.now()
  logger.info('Push run started')

  const { data: recentRun } = await supabase
    .from('push_runs')
    .select('id, created_at')
    .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recentRun) {
    logger.warn({ recentRunId: recentRun.id, createdAt: recentRun.created_at }, 'Skipping push run — recent run within 10 minutes')
    return
  }

  let succeeded = 0
  let failed = 0
  let totalCandidates = 0
  let errorMsg: string | undefined

  try {
    const stats = await buildPushJobs(supabase, channelRegistry, dispatchLimit)
    succeeded = stats.succeeded
    failed = stats.failed
    totalCandidates = stats.totalCandidates

    if (succeeded === 0 && totalCandidates > 0) {
      errorMsg = `All candidates processed but 0 messages delivered (${totalCandidates} candidates)`
      throw new Error(errorMsg)
    }
  } catch (err) {
    if (!errorMsg) errorMsg = String(err)
    throw err
  } finally {
    await recordPushRun(supabase, {
      candidates: totalCandidates,
      succeeded,
      failed,
      durationMs: Date.now() - startMs,
      errorMsg,
    })
  }
}

main()
  .then(() => {
    logger.info('Push run complete')
    process.exit(0)
  })
  .catch(async (err) => {
    logger.fatal({ err }, 'Push run failed')
    process.exit(1)
  })
```

- [ ] **Step 2: Remove Sentry from push.logic.ts**

In `apps/worker/src/workers/push.logic.ts`, remove the two `try { const Sentry = ... } catch {}` blocks (lines 248-258 and lines 287-296). Keep the surrounding logic intact.

- [ ] **Step 3: Remove SENTRY_DSN from config schema**

In `apps/worker/src/lib/config.schema.ts`, remove the `SENTRY_DSN` line:

```typescript
import { z } from 'zod'

export const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(1).optional().default('CaffeCode <noreply@caffecode.net>'),
  APP_URL: z.string().url().default('https://caffecode.net'),
})
```

- [ ] **Step 4: Remove @sentry/node from package.json**

```bash
cd /home/bolin8017/Documents/repositories/caffecode/apps/worker
pnpm remove @sentry/node
```

- [ ] **Step 5: Run worker tests**

```bash
cd /home/bolin8017/Documents/repositories/caffecode/apps/worker
pnpm exec vitest run
```

Expected: All 76 tests pass. Some tests mocking Sentry may need updating — fix any failures.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/index.ts apps/worker/src/workers/push.logic.ts apps/worker/src/lib/config.schema.ts apps/worker/package.json pnpm-lock.yaml
git commit -m "refactor(worker): remove unused @sentry/node dependency

SENTRY_DSN was never configured. Removes dead Sentry imports, init,
breadcrumbs, and flush calls from index.ts and push.logic.ts."
```

---

### Task 3: Add react-email dependencies to web app

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd /home/bolin8017/Documents/repositories/caffecode/apps/web
pnpm add @react-email/components @react-email/render
```

Note: `p-limit`, `react`, `react-dom`, `pino`, `zod`, `@supabase/supabase-js` are already in web's dependencies.

- [ ] **Step 2: Verify build still works**

```bash
cd /home/bolin8017/Documents/repositories/caffecode
pnpm --filter @caffecode/shared build && pnpm --filter @caffecode/web build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "build(web): add @react-email/components and @react-email/render

Needed for the push cron API route to render email notifications."
```

---

### Task 4: Create the cron push API route

**Files:**
- Create: `apps/web/app/api/cron/push/route.ts`

- [ ] **Step 1: Write the API route**

Create `apps/web/app/api/cron/push/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import pLimit from 'p-limit'
import { logger } from '@/lib/logger'
import { buildPushJobs } from '../../../../apps/worker/src/workers/push.logic'
import { recordPushRun } from '../../../../apps/worker/src/repositories/push.repository'
import { TelegramChannel } from '../../../../apps/worker/src/channels/telegram'
import { LineChannel } from '../../../../apps/worker/src/channels/line'
import { EmailChannel } from '../../../../apps/worker/src/channels/email'
import type { NotificationChannel } from '../../../../apps/worker/src/channels/interface'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 10-minute overlap guard
  const { data: recentRun } = await supabase
    .from('push_runs')
    .select('id, created_at')
    .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentRun) {
    logger.warn({ recentRunId: recentRun.id }, 'Skipping push run — recent run within 10 minutes')
    return Response.json({ skipped: true, reason: 'recent_run' })
  }

  const startMs = Date.now()
  let succeeded = 0
  let failed = 0
  let totalCandidates = 0
  let errorMsg: string | undefined

  try {
    const channelRegistry: Record<string, NotificationChannel> = {
      telegram: new TelegramChannel(process.env.TELEGRAM_BOT_TOKEN!),
      line: new LineChannel(process.env.LINE_CHANNEL_ACCESS_TOKEN!),
      ...(process.env.RESEND_API_KEY
        ? { email: new EmailChannel(
            process.env.RESEND_API_KEY,
            process.env.RESEND_FROM_EMAIL ?? 'CaffeCode <noreply@caffecode.net>',
          ) }
        : {}),
    }

    const dispatchLimit = pLimit(5)
    const stats = await buildPushJobs(supabase, channelRegistry, dispatchLimit)
    succeeded = stats.succeeded
    failed = stats.failed
    totalCandidates = stats.totalCandidates
  } catch (err) {
    errorMsg = String(err)
    logger.error({ err }, 'Push run failed')
  } finally {
    await recordPushRun(supabase, {
      candidates: totalCandidates,
      succeeded,
      failed,
      durationMs: Date.now() - startMs,
      errorMsg,
    })
  }

  return Response.json({
    ok: !errorMsg,
    candidates: totalCandidates,
    succeeded,
    failed,
    durationMs: Date.now() - startMs,
  })
}
```

**Important**: The relative import paths from `apps/web/app/api/cron/push/` to `apps/worker/src/` go up through the monorepo root. Next.js/Turbopack resolves these at build time since both packages are in the same repo. If the build fails due to path resolution, add a `@worker` path alias to `apps/web/tsconfig.json`:

```json
"paths": {
  "@/*": ["./*"],
  "@worker/*": ["../../apps/worker/src/*"]
}
```

And update imports to use `@worker/workers/push.logic` etc.

- [ ] **Step 2: Verify the build**

```bash
cd /home/bolin8017/Documents/repositories/caffecode
pnpm --filter @caffecode/shared build && pnpm --filter @caffecode/web build
```

Expected: Build succeeds. If path resolution fails, add the `@worker` alias as described above and rebuild.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/cron/push/route.ts
# If tsconfig was modified:
# git add apps/web/tsconfig.json
git commit -m "feat(web): add /api/cron/push API route for pg_cron trigger

Replaces Railway worker entry point. Authenticates via CRON_SECRET
Bearer token, runs identical push logic (buildPushJobs), records
push_runs, returns JSON stats."
```

---

### Task 5: Write tests for the cron push API route

**Files:**
- Create: `apps/web/__tests__/api/cron/push/route.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/web/__tests__/api/cron/push/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing route
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))

// Mock worker modules — adjust path if using @worker alias
vi.mock('../../../../apps/worker/src/workers/push.logic', () => ({
  buildPushJobs: vi.fn(),
}))

vi.mock('../../../../apps/worker/src/repositories/push.repository', () => ({
  recordPushRun: vi.fn(),
}))

vi.mock('../../../../apps/worker/src/channels/telegram', () => ({
  TelegramChannel: vi.fn(),
}))

vi.mock('../../../../apps/worker/src/channels/line', () => ({
  LineChannel: vi.fn(),
}))

vi.mock('../../../../apps/worker/src/channels/email', () => ({
  EmailChannel: vi.fn(),
}))

const mockMaybeSingle = vi.fn()
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      gte: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      })),
    })),
  })),
}

import { POST } from '@/app/api/cron/push/route'
import { buildPushJobs } from '../../../../apps/worker/src/workers/push.logic'
import { recordPushRun } from '../../../../apps/worker/src/repositories/push.repository'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  process.env.TELEGRAM_BOT_TOKEN = 'test-telegram'
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-line'
})

describe('POST /api/cron/push', () => {
  it('rejects requests without valid auth', async () => {
    const req = new Request('http://localhost/api/cron/push', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer wrong-secret' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('rejects requests with no auth header', async () => {
    const req = new Request('http://localhost/api/cron/push', {
      method: 'POST',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('skips when recent push run exists', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'run-1', created_at: new Date().toISOString() },
      error: null,
    })

    const req = new Request('http://localhost/api/cron/push', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-secret' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body.skipped).toBe(true)
    expect(body.reason).toBe('recent_run')
    expect(buildPushJobs).not.toHaveBeenCalled()
  })

  it('runs push pipeline and returns stats', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    vi.mocked(buildPushJobs).mockResolvedValue({
      totalCandidates: 5,
      succeeded: 4,
      failed: 1,
    })
    vi.mocked(recordPushRun).mockResolvedValue(undefined)

    const req = new Request('http://localhost/api/cron/push', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-secret' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.candidates).toBe(5)
    expect(body.succeeded).toBe(4)
    expect(body.failed).toBe(1)
    expect(recordPushRun).toHaveBeenCalledOnce()
  })

  it('handles push pipeline errors gracefully', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    vi.mocked(buildPushJobs).mockRejectedValue(new Error('DB connection failed'))
    vi.mocked(recordPushRun).mockResolvedValue(undefined)

    const req = new Request('http://localhost/api/cron/push', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-secret' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(false)
    expect(recordPushRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorMsg: expect.stringContaining('DB connection failed') }),
    )
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd /home/bolin8017/Documents/repositories/caffecode/apps/web
pnpm exec vitest run __tests__/api/cron/push/route.test.ts
```

Expected: All 5 tests pass. If mock paths don't resolve, update to match the actual import paths used in route.ts (e.g., `@worker/...`).

- [ ] **Step 3: Run all web tests to confirm no regressions**

```bash
cd /home/bolin8017/Documents/repositories/caffecode/apps/web
pnpm exec vitest run
```

Expected: All 560+ tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/__tests__/api/cron/push/route.test.ts
git commit -m "test(web): add unit tests for /api/cron/push route

Covers: auth rejection, overlap guard skip, successful push pipeline,
and error handling with recordPushRun."
```

---

### Task 6: Enable pg_cron + pg_net and schedule the job

**Files:**
- Create: `supabase/migrations/20260327000002_enable_pgcron_pgnet.sql`

- [ ] **Step 1: Generate a CRON_SECRET value**

```bash
openssl rand -base64 32
```

Save this value — it will be used in both Supabase Vault and Vercel env vars.

- [ ] **Step 2: Add CRON_SECRET to Vercel environment variables**

```bash
echo "<generated-secret>" | vercel env add CRON_SECRET production
```

Also add the worker-specific env vars that the web app now needs (if not already present):

```bash
vercel env ls | grep -E "TELEGRAM_BOT_TOKEN|LINE_CHANNEL_ACCESS_TOKEN|RESEND_API_KEY|RESEND_FROM_EMAIL|APP_URL"
```

For any missing vars, add them:

```bash
echo "<value>" | vercel env add TELEGRAM_BOT_TOKEN production
echo "<value>" | vercel env add LINE_CHANNEL_ACCESS_TOKEN production
echo "<value>" | vercel env add RESEND_API_KEY production
echo "CaffeCode <noreply@caffecode.net>" | vercel env add RESEND_FROM_EMAIL production
echo "https://caffecode.net" | vercel env add APP_URL production
```

- [ ] **Step 3: Write the migration SQL**

Create `supabase/migrations/20260327000002_enable_pgcron_pgnet.sql`:

```sql
-- Enable pg_cron and pg_net for scheduled HTTP triggers.
-- pg_cron: database-level cron scheduler (minute precision)
-- pg_net: async HTTP client for outbound requests from SQL

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

- [ ] **Step 4: Apply the migration**

Use Supabase MCP `apply_migration` with name `enable_pgcron_pgnet` and the SQL above.

- [ ] **Step 5: Store the secret in Supabase Vault and schedule the cron job**

Run via Supabase MCP `execute_sql`:

```sql
-- Store the CRON_SECRET in Vault
SELECT vault.create_secret('<same-generated-secret>', 'cron_secret');

-- Schedule hourly push trigger
SELECT cron.schedule(
  'hourly-push-trigger',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://caffecode.net/api/cron/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cron_secret'
      )
    ),
    body := jsonb_build_object('triggered_at', now()),
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);
```

Note: The vault secret and cron.schedule are runtime state (not migratable), so they're applied via `execute_sql` rather than in the migration file.

- [ ] **Step 6: Verify the cron job is registered**

Run via Supabase MCP `execute_sql`:

```sql
SELECT jobid, schedule, command FROM cron.job WHERE jobname = 'hourly-push-trigger';
```

Expected: One row with `schedule = '0 * * * *'`.

- [ ] **Step 7: Commit the migration file**

```bash
git add supabase/migrations/20260327000002_enable_pgcron_pgnet.sql
git commit -m "ci(db): enable pg_cron and pg_net extensions

Required for hourly push trigger via pg_cron + pg_net HTTP POST.
Vault secret and cron.schedule applied at runtime via execute_sql."
```

---

### Task 7: Update documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `CLAUDE.local.md`
- Modify: `README.md`

- [ ] **Step 1: Update CLAUDE.md Architecture table**

Replace the Worker row in the Architecture table:

```markdown
| Worker | `apps/worker/` | Vercel Serverless (via pg_cron) | Candidate scan → problem selection → channel dispatch |
```

- [ ] **Step 2: Update CLAUDE.md Deployment table**

Replace the Worker row:

```markdown
| Worker | Vercel (triggered by Supabase pg_cron) | Auto-deployed with web via `git push origin main` |
```

Remove or update any references to `railway up --detach` in the deploy checklist and deploy rules sections.

- [ ] **Step 3: Update CLAUDE.md Development Notes**

Remove the line about Railway CLI. Add:

```
**Worker cron**: `pg_cron` (Supabase) fires `pg_net` HTTP POST to `/api/cron/push` every hour. Auth via `CRON_SECRET` Bearer token (Supabase Vault + Vercel env var). Catch-up model: missed hours are recovered on the next successful trigger.
```

- [ ] **Step 4: Update CLAUDE.md Cloud Services table**

Remove the Railway row. Add under Supabase:

```
| Supabase | PostgreSQL + Auth + RLS + pg_cron/pg_net | Yes |
```

- [ ] **Step 5: Update CLAUDE.local.md**

Remove the `railway` line from the CLI Tools Available section:

```markdown
## CLI Tools Available

- `gh` — GitHub CLI (authenticated)
```

- [ ] **Step 6: Update README.md**

Update the architecture description to reflect that the worker now runs as a Vercel serverless function triggered by Supabase pg_cron. Remove any mention of Railway.

- [ ] **Step 7: Update test counts in CLAUDE.md if changed**

Check current counts:

```bash
cd /home/bolin8017/Documents/repositories/caffecode
pnpm --filter @caffecode/shared exec vitest run 2>&1 | tail -3
pnpm --filter @caffecode/worker exec vitest run 2>&1 | tail -3
pnpm --filter @caffecode/web exec vitest run 2>&1 | tail -3
```

Update the test count line in CLAUDE.md Development Notes accordingly. The web count should increase by ~5 (new route tests).

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md CLAUDE.local.md README.md
git commit -m "docs: update architecture for pg_cron + Vercel worker migration

Remove Railway references. Document pg_cron trigger, catch-up model,
CRON_SECRET auth, and updated deployment workflow."
```

---

### Task 8: Final verification and PR

- [ ] **Step 1: Run all tests**

```bash
cd /home/bolin8017/Documents/repositories/caffecode
pnpm --filter @caffecode/shared exec vitest run
pnpm --filter @caffecode/worker exec vitest run
pnpm --filter @caffecode/web exec vitest run
```

Expected: All tests pass across all three packages.

- [ ] **Step 2: Run the full build**

```bash
cd /home/bolin8017/Documents/repositories/caffecode
pnpm --filter @caffecode/shared build && pnpm --filter @caffecode/web build
```

Expected: Build succeeds.

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin refactor/worker-pgcron-vercel
```

Create PR with:
- Title: `refactor(worker): migrate from Railway to pg_cron + Vercel API route`
- Body: Summary of changes, link to spec, deployment sequence

- [ ] **Step 4: Post-merge deployment verification**

After PR is merged and Vercel auto-deploys:

1. Wait for the next hour mark
2. Check `push_runs` table: `SELECT * FROM push_runs ORDER BY created_at DESC LIMIT 5;`
3. Check `net._http_response` for the trigger: `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;`
4. Verify notifications were delivered (check Telegram/LINE/Email)
5. Once confirmed, stop the Railway service (if still running)
