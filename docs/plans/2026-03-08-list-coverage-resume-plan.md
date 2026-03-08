# List Coverage & Resume Position Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure every problem belongs to at least one curated list (206 orphans → 0), and let users resume or set a custom start position when subscribing to lists.

**Architecture:** Generate 12 new list JSON files via a Python script that groups orphan problems by topic. Add `subscribeToList` Server Action that accepts optional `startPosition`. Update `/lists/[slug]` page with subscribe/resume/start-from-here UI. Import all lists to Supabase via existing `build_database.py`.

**Tech Stack:** Python (list generation), Next.js 16, React 19, Supabase, Vitest

---

### Task 1: Generate 12 new list JSON files + expand 4 existing lists

**Files:**
- Create: `scripts/generate_topic_lists.py`
- Modify: `data/lists/dp-patterns.json`
- Modify: `data/lists/linked-list-patterns.json`
- Modify: `data/lists/bit-manipulation.json`
- Modify: `data/lists/union-find.json`
- Create: 12 new files in `data/lists/`

**Step 1: Write the list generation script**

Create `scripts/generate_topic_lists.py`:

```python
#!/usr/bin/env python3
"""
Generate topic-based curated list JSON files for orphan problems.

Reads all problem files and existing lists, finds problems not in any list,
and assigns them to topic-based lists. Problems can appear in multiple lists
(cross-listing by topic match).

Also appends specific orphans to existing lists.

Usage:
  python3 scripts/generate_topic_lists.py [--dry-run]
"""

import json
import glob
import argparse
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).parent.parent / "data"
PROBLEMS_DIR = DATA_DIR / "problems"
LISTS_DIR = DATA_DIR / "lists"

CONTENT_FIELDS = [
    "explanation", "solution_code", "complexity_analysis",
    "pseudocode", "alternative_approaches", "follow_up",
]

# New lists: slug → (name, description, type, matching topics)
NEW_LISTS = {
    "segment-tree-bit": (
        "Segment Tree & BIT",
        "Master segment trees and binary indexed trees for range queries and updates.",
        "algorithm",
        {"segment-tree", "binary-indexed-tree"},
    ),
    "design-patterns": (
        "System Design Patterns",
        "Practice data structure design problems commonly asked in interviews.",
        "topic",
        {"design"},
    ),
    "graph-advanced": (
        "Graph Advanced",
        "Advanced graph algorithms including topological sort, shortest paths, and network flow.",
        "topic",
        {"graph", "topological-sort"},
    ),
    "number-theory": (
        "Number Theory & Combinatorics",
        "Number theory, counting, combinatorics, and probability problems.",
        "topic",
        {"number-theory", "counting"},
    ),
    "string-advanced": (
        "String Advanced",
        "Advanced string manipulation, matching, and parsing problems.",
        "topic",
        {"string"},
    ),
    "queue-deque": (
        "Queue & Deque Patterns",
        "Queue, deque, and monotonic queue pattern problems.",
        "algorithm",
        {"queue", "monotonic-queue"},
    ),
    "sorting-patterns": (
        "Sorting & Ordered Set",
        "Sorting algorithms, ordered sets, and related data structure problems.",
        "algorithm",
        {"sorting", "ordered-set"},
    ),
    "simulation": (
        "Simulation & Implementation",
        "Simulation and step-by-step implementation problems.",
        "topic",
        {"simulation"},
    ),
    "divide-conquer": (
        "Divide & Conquer",
        "Divide and conquer algorithm problems.",
        "algorithm",
        {"divide-and-conquer"},
    ),
    "tree-bst": (
        "BST Patterns",
        "Binary search tree construction, traversal, and manipulation patterns.",
        "topic",
        {"binary-search-tree", "binary-tree"},
    ),
    "game-theory": (
        "Game Theory",
        "Game theory and minimax strategy problems.",
        "topic",
        {"game-theory"},
    ),
    "geometry": (
        "Geometry & Math",
        "Computational geometry and spatial math problems.",
        "topic",
        {"geometry"},
    ),
}

# Orphans to append to existing lists: leetcode_id → list slug
EXISTING_LIST_EXPANSIONS = {
    256: "dp-patterns",
    2487: "linked-list-patterns",
    1863: "bit-manipulation",
    2334: "union-find",
}


def load_all_list_ids() -> set[int]:
    """Return all problem IDs already in any list."""
    ids = set()
    for f in LISTS_DIR.glob("*.json"):
        with open(f) as fh:
            for pid in json.load(fh).get("problem_ids", []):
                ids.add(pid)
    return ids


def load_orphans(existing_ids: set[int]) -> list[dict]:
    """Load problems with content that aren't in any list."""
    orphans = []
    for f in PROBLEMS_DIR.glob("*.json"):
        with open(f) as fh:
            p = json.load(fh)
            if (
                any(p.get(field) for field in CONTENT_FIELDS)
                and p["leetcode_id"] not in existing_ids
            ):
                orphans.append(p)
    return orphans


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print assignments without writing files")
    args = parser.parse_args()

    existing_ids = load_all_list_ids()
    orphans = load_orphans(existing_ids)
    print(f"Found {len(orphans)} orphan problems")

    # Assign orphans to new lists (cross-listing allowed)
    assignments: dict[str, list[int]] = defaultdict(list)
    covered = set()

    for p in orphans:
        topics = set(p.get("topics", []))
        for slug, (_, _, _, match_topics) in NEW_LISTS.items():
            if topics & match_topics:
                assignments[slug].append(p["leetcode_id"])
                covered.add(p["leetcode_id"])

    # Handle specific expansions
    for lid, list_slug in EXISTING_LIST_EXPANSIONS.items():
        if lid not in covered:
            covered.add(lid)

    uncovered = [p for p in orphans if p["leetcode_id"] not in covered]
    if uncovered:
        print(f"WARNING: {len(uncovered)} problems still uncovered:")
        for p in uncovered:
            print(f"  #{p['leetcode_id']} {p['title']} topics={p['topics']}")
        return

    print(f"\nAll {len(orphans)} orphans covered.")

    # Write new list files
    for slug, (name, description, list_type, _) in NEW_LISTS.items():
        ids = sorted(assignments.get(slug, []))
        if not ids:
            print(f"  SKIP {slug}: 0 problems")
            continue

        list_obj = {
            "slug": slug,
            "name": name,
            "description": description,
            "type": list_type,
            "problem_ids": ids,
        }

        out = LISTS_DIR / f"{slug}.json"
        print(f"  {slug}: {len(ids)} problems → {out}")
        if not args.dry_run:
            out.write_text(json.dumps(list_obj, indent=2, ensure_ascii=False) + "\n")

    # Expand existing lists
    for lid, list_slug in EXISTING_LIST_EXPANSIONS.items():
        list_file = LISTS_DIR / f"{list_slug}.json"
        with open(list_file) as fh:
            lst = json.load(fh)
        if lid not in lst["problem_ids"]:
            lst["problem_ids"].append(lid)
            print(f"  +#{lid} → {list_slug} (now {len(lst['problem_ids'])} problems)")
            if not args.dry_run:
                list_file.write_text(json.dumps(lst, indent=2, ensure_ascii=False) + "\n")

    if args.dry_run:
        print("\n(dry-run — no files written)")
    else:
        print("\nDone. Run: python3 scripts/build_database.py --list all")


if __name__ == "__main__":
    main()
```

**Step 2: Run with --dry-run to verify**

Run: `cd /home/bolin8017/Documents/repositories/caffecode && /home/bolin8017/.pyenv/shims/python3 scripts/generate_topic_lists.py --dry-run`
Expected: All 206 orphans covered, 12 new lists printed, 4 existing expansions printed, 0 uncovered.

**Step 3: Run for real**

Run: `/home/bolin8017/.pyenv/shims/python3 scripts/generate_topic_lists.py`
Expected: 12 new JSON files created in `data/lists/`, 4 existing list files updated.

**Step 4: Import to Supabase**

Run: `/home/bolin8017/.pyenv/shims/python3 scripts/build_database.py --list all`
Expected: 45 lists imported, all problems upserted.

**Step 5: Verify database counts**

Run SQL via Supabase MCP:
```sql
SELECT
  (SELECT COUNT(*) FROM problems) AS total_problems,
  (SELECT COUNT(*) FROM problem_content) AS with_content,
  (SELECT COUNT(*) FROM curated_lists) AS total_lists,
  (SELECT COUNT(*) FROM problems p
   WHERE NOT EXISTS (
     SELECT 1 FROM list_problems lp WHERE lp.problem_id = p.id
   )) AS orphan_problems
```
Expected: `total_problems >= 810`, `orphan_problems = 0`, `total_lists = 45`.

**Step 6: Commit**

```
feat(data): add 12 topic lists and expand 4 existing lists

Ensures every problem with content belongs to at least one curated
list. Cross-listing by topic is allowed for accurate categorization.
```

Note: `data/` is in `.gitignore` so only `scripts/generate_topic_lists.py` will be committed to git.

---

### Task 2: Add subscribeToList Server Action (TDD)

**Files:**
- Modify: `apps/web/lib/actions/settings.ts`
- Create: `apps/web/lib/__tests__/subscribe-list.test.ts`

**Step 1: Write failing test**

Create `apps/web/lib/__tests__/subscribe-list.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})
const mockFrom = vi.fn().mockReturnValue({
  upsert: mockUpsert,
  update: mockUpdate,
})
const mockSupabase = { from: mockFrom }

import { getAuthUser } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue({
    supabase: mockSupabase as unknown,
    user: { id: 'user-123' } as unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
})

describe('subscribeToList', () => {
  it('subscribes without startPosition (preserves existing position)', async () => {
    const { subscribeToList } = await import('@/lib/actions/settings')
    await subscribeToList(5)

    // Should upsert WITHOUT current_position
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ current_position: expect.anything() }),
      expect.anything()
    )
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', list_id: 5, is_active: true }),
      expect.anything()
    )
  })

  it('subscribes with startPosition', async () => {
    const { subscribeToList } = await import('@/lib/actions/settings')
    await subscribeToList(5, 10)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ current_position: 10 }),
      expect.anything()
    )
  })

  it('rejects negative startPosition', async () => {
    const { subscribeToList } = await import('@/lib/actions/settings')
    await expect(subscribeToList(5, -1)).rejects.toThrow()
  })

  it('rejects non-integer listId', async () => {
    const { subscribeToList } = await import('@/lib/actions/settings')
    await expect(subscribeToList(1.5)).rejects.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec vitest run lib/__tests__/subscribe-list.test.ts`
Expected: FAIL — `subscribeToList` not found.

**Step 3: Write implementation**

In `apps/web/lib/actions/settings.ts`, add the following import and function after the existing `updateLearningMode`:

```typescript
import { revalidatePath } from 'next/cache'
```

(Add to existing imports if not present.)

```typescript
const subscribeSchema = z.object({
  listId: z.number().int().positive(),
  startPosition: z.number().int().min(0).optional(),
})

export async function subscribeToList(listId: number, startPosition?: number) {
  const { supabase, user } = await getAuthUser()
  subscribeSchema.parse({ listId, startPosition })

  await updateUser(supabase, user.id, { active_mode: 'list' })
  await deactivateAllLists(supabase, user.id)

  const progressData: {
    user_id: string
    list_id: number
    is_active: boolean
    current_position?: number
  } = {
    user_id: user.id,
    list_id: listId,
    is_active: true,
  }

  if (startPosition !== undefined) {
    progressData.current_position = startPosition
  }

  await upsertListProgress(supabase, progressData)

  revalidatePath('/dashboard')
  revalidatePath('/settings/learning')
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec vitest run lib/__tests__/subscribe-list.test.ts`
Expected: All 4 tests PASS.

**Step 5: Run all web tests**

Run: `cd apps/web && pnpm exec vitest run`
Expected: All tests pass (no regressions).

**Step 6: Commit**

```
feat(web): add subscribeToList Server Action with optional start position
```

---

### Task 3: Add list subscription UI to list detail page

**Files:**
- Create: `apps/web/app/(public)/lists/[slug]/list-subscribe-bar.tsx`
- Modify: `apps/web/app/(public)/lists/[slug]/page.tsx:89-120`

**Step 1: Create ListSubscribeBar client component**

Create `apps/web/app/(public)/lists/[slug]/list-subscribe-bar.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { subscribeToList } from '@/lib/actions/settings'

interface Props {
  listId: number
  listName: string
  problemCount: number
  userProgress: {
    current_position: number
    is_active: boolean
  } | null
}

export function ListSubscribeBar({ listId, listName, problemCount, userProgress }: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const handleSubscribe = (startPosition?: number) => {
    setMessage(null)
    startTransition(async () => {
      try {
        await subscribeToList(listId, startPosition)
        setMessage(startPosition !== undefined
          ? `已從第 ${startPosition + 1} 題開始學習「${listName}」`
          : '已開始學習此清單')
      } catch {
        setMessage('訂閱失敗，請重試')
      }
    })
  }

  // Currently active on this list
  if (userProgress?.is_active) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-primary">
          目前學習中 · {userProgress.current_position} / {problemCount} 題
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSubscribe(0)}
          disabled={isPending}
        >
          從頭開始
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    )
  }

  // Has previous progress (returning user)
  if (userProgress && userProgress.current_position > 0) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          size="sm"
          onClick={() => handleSubscribe()}
          disabled={isPending}
        >
          從第 {userProgress.current_position + 1} 題繼續
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSubscribe(0)}
          disabled={isPending}
        >
          從頭開始
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    )
  }

  // Never subscribed
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        size="sm"
        onClick={() => handleSubscribe()}
        disabled={isPending}
      >
        訂閱此清單
      </Button>
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  )
}
```

**Step 2: Create StartFromHereButton client component**

Add to the same file `list-subscribe-bar.tsx`:

```tsx
export function StartFromHereButton({
  listId,
  sequenceNumber,
}: {
  listId: number
  sequenceNumber: number
}) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      await subscribeToList(listId, sequenceNumber - 1)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
      title={`從第 ${sequenceNumber} 題開始`}
    >
      ▶
    </button>
  )
}
```

**Step 3: Update list detail page**

In `apps/web/app/(public)/lists/[slug]/page.tsx`:

Add import at top:
```tsx
import { ListSubscribeBar, StartFromHereButton } from './list-subscribe-bar'
```

Replace the progress bar section (lines 102-119) with:
```tsx
{/* Subscribe bar + Progress for logged-in users */}
{user && (
  <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-3">
    <ListSubscribeBar
      listId={list.id}
      listName={list.name}
      problemCount={list.problem_count}
      userProgress={userProgress}
    />
    {userProgress && (
      <div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    )}
  </div>
)}
```

In the table row, after the solved checkmark column, add a "start from here" column for authenticated users. Add to the `<thead>`:
```tsx
{user && <th className="px-1 py-3 w-8" />}
```

And in the `<tbody>` row, after the solved checkmark `<td>`:
```tsx
{user && (
  <td className="px-1 py-3 text-center">
    <StartFromHereButton listId={list.id} sequenceNumber={lp.sequence_number} />
  </td>
)}
```

**Step 4: Verify build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds.

**Step 5: Run lint**

Run: `cd apps/web && pnpm lint`
Expected: 0 errors.

**Step 6: Commit**

```
feat(web): add list subscribe/resume UI on list detail page

Users can now subscribe to lists from the list page with auto-resume,
start-over, or start-from-any-position options.
```

---

### Task 4: Update hardcoded counts and CLAUDE.md rules

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/(public)/lists/page.tsx`

**Step 1: Update CLAUDE.md**

Add to the "Content" line: update list count from 33 to 45.

Update "Data & Scripts" section: update list count.

Add new rule under "Key Patterns" → after "List position indexing":

```markdown
- **List coverage invariant**: Every problem with content MUST belong to at least one curated list. `build_database.py` only imports list-referenced problems — orphans are invisible on the site. When adding new problems, create or expand topic lists to maintain zero orphans. Use `scripts/generate_topic_lists.py` to verify coverage.
```

Add `scripts/generate_topic_lists.py` to Key Files → Data & Scripts:

```markdown
- `scripts/generate_topic_lists.py` — Assigns orphan problems (with content but not in any list) to topic-based curated lists. Cross-lists by topic match. Usage: `python3 scripts/generate_topic_lists.py [--dry-run]`
```

Update test count in Development Notes if changed.

**Step 2: Update hardcoded counts in pages**

In `apps/web/app/page.tsx`: change `33 份精選清單` → `45 份精選清單`.

In `apps/web/app/(public)/lists/page.tsx`: change `33 份精選刷題清單` → `45 份精選刷題清單`.

Update `README.md` list count.

**Step 3: Commit**

```
docs: update list counts and add list coverage invariant rule
```

---

### Task 5: Final verification

**Step 1: Run full test suite**

```bash
cd apps/web && pnpm exec vitest run
cd ../../packages/shared && pnpm exec vitest run
cd ../../apps/worker && pnpm exec vitest run
```

Expected: All tests pass.

**Step 2: Lint**

```bash
cd apps/web && pnpm lint
```

Expected: 0 errors.

**Step 3: Full build**

```bash
pnpm turbo build
```

Expected: All packages build successfully.

**Step 4: Verify database**

Run SQL:
```sql
SELECT
  (SELECT COUNT(*) FROM problems) AS total_problems,
  (SELECT COUNT(*) FROM problem_content) AS with_content,
  (SELECT COUNT(*) FROM curated_lists) AS total_lists,
  (SELECT COUNT(*) FROM problems p
   WHERE NOT EXISTS (SELECT 1 FROM list_problems lp WHERE lp.problem_id = p.id)
  ) AS orphan_problems
```

Expected: `orphan_problems = 0`, `total_lists = 45`, `total_problems >= 810`.

---

## Dependency Graph

```
Task 1 (list generation + DB import) ← independent
    ↓
Task 2 (subscribeToList action) ← independent of Task 1
    ↓
Task 3 (list detail page UI) ← depends on Task 2
    ↓
Task 4 (counts + CLAUDE.md) ← depends on Task 1 (final counts)
    ↓
Task 5 (verification) ← depends on all
```

Parallelizable: Task 1 + Task 2 can run simultaneously.
