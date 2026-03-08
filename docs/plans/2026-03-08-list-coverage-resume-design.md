# List Coverage & Resume Position Design

## Goal

1. Ensure every problem with content belongs to at least one curated list (zero orphans).
2. When subscribing to a previously visited list, auto-resume from last position instead of resetting to 0.
3. Allow users to manually set a starting position from the list detail page.

## Context

- 810 problems with content, but only 604 unique problems across 33 lists → 206 orphan problems invisible on the problems page (`!inner` join on `problem_content` already covers this, but orphans aren't in `problems` table either since `build_database.py` only imports list-referenced problems).
- `user_list_progress` already tracks `current_position` per user per list, but `upsertListProgress` resets position to 0 on every list switch.

---

## Part 1: List Coverage — 12 New Lists + 4 Existing Expansions

### New Lists

| Slug | Name | Estimated Count | Type |
|------|------|----------------|------|
| `segment-tree-bit` | Segment Tree & BIT | ~38 | algorithm |
| `design-patterns` | System Design Patterns | ~40 | topic |
| `graph-advanced` | Graph Advanced | ~53 | topic |
| `number-theory` | Number Theory & Combinatorics | ~38 | topic |
| `string-advanced` | String Advanced | ~27 | topic |
| `queue-deque` | Queue & Deque Patterns | ~30 | algorithm |
| `sorting-patterns` | Sorting & Ordered Set | ~51 | algorithm |
| `simulation` | Simulation & Implementation | ~25 | topic |
| `divide-conquer` | Divide & Conquer | ~17 | algorithm |
| `tree-bst` | BST Patterns | ~13 | topic |
| `game-theory` | Game Theory | ~7 | topic |
| `geometry` | Geometry & Math | ~6 | topic |

### Existing List Expansions

| List | Problem Added | Reason |
|------|--------------|--------|
| `dp-patterns` | #256 Paint House | dynamic-programming |
| `linked-list-patterns` | #2487 Remove Nodes From Linked List | linked-list |
| `bit-manipulation` | #1863 Sum of All Subset XOR Totals | bit-manipulation |
| `union-find` | #2334 Subarray With Elements Greater Than Varying Threshold | union-find |

### Assignment Rules

- Problems are assigned to ALL lists whose topics they match (cross-listing allowed).
- Assignment priority: most specific topic first (segment-tree > array).
- Topic matching uses the problem's full topic array, not just the primary topic.
- Result: 45 total lists, 0 orphan problems.

### CLAUDE.md Rule (permanent)

> Every problem with content MUST belong to at least one curated list. When adding new problems, create or expand lists to maintain this invariant. The `build_database.py --list all` command only imports list-referenced problems — orphan problems will be invisible on the site.

---

## Part 2: List Resume & Start Position

### Industry References

- **Duolingo**: Auto-resumes skill tree position; can tap any lesson to start there.
- **Netflix**: "Continue Watching" is default; can browse and pick any episode.
- **Kindle**: Syncs last reading position; table of contents allows jumping to any chapter.

### Behavior Changes

#### Auto-Resume (default)

**Current:** `upsertListProgress` always passes `current_position: 0` when switching lists.

**New:** When switching to a list the user has subscribed to before:
- The existing `user_list_progress` row already has `current_position` from last time.
- `upsertListProgress` should NOT pass `current_position` for re-subscriptions, preserving the old value.
- For first-time subscriptions, `current_position` defaults to 0 (DB default).

**Code changes:**
- `updateLearningMode` in `settings.ts`: remove `current_position: 0` from upsert (already not passed, but verify).
- `onboarding.ts`: keep `current_position: 0` for first-time setup (user has no history).

#### Manual Start Position

**Where:** List detail page (`/lists/[slug]`) — only for authenticated users.

**UI elements:**
1. **Subscribe button** at the top of the list page:
   - Not subscribed: "Subscribe to this list" → starts from position 0
   - Previously subscribed: "Continue from #N" (primary) + "Start over" (secondary)
   - Currently active list: shows current position indicator
2. **Per-row "Start from here"**: each problem row shows its sequence number; clicking a "start from here" action subscribes and sets `current_position = sequence_number - 1`.

**Data flow:**
- New Server Action: `subscribeToList(listId: number, startPosition?: number)`
  - Calls `deactivateAllLists` + `upsertListProgress` with optional `current_position`
  - Updates `active_mode: 'list'` on user
- List page fetches `user_list_progress` for the current user + list to show resume state.

**Impact analysis:**
- Worker `selectProblemForUser`: reads `current_position` → queries `sequence_number = current_position + 1`. No change needed — it already uses whatever position is stored.
- `advance_list_positions` RPC: updates `current_position = sequence_number` after delivery. No change needed.
- Dashboard: shows active list progress. No change needed — reads from `user_list_progress`.

---

## Non-Goals

- Reordering problems within a list (out of scope).
- Creating lists from the web UI (admin-only, uses data files).
- Changing the `!inner` join on the problems page (all problems will be in lists, so this is moot).
