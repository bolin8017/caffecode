---
paths:
  - "scripts/**"
  - "data/**"
---

# Data & Scripts

- `data/` — **Not tracked in git**. Contains 45 list definitions and problem JSON files. Imported into Supabase via `build_database.py`.
- `data/sync-report.json` — Tracks `with_content` vs `metadata_only` counts + `metadata_only_ids` list
- `scripts/sync_leetcode.py` — Fetches LeetCode metadata via GraphQL API + zerotrac contest ratings. Merges metadata while preserving existing AI content. Skips paid-only. Usage: `python3 scripts/sync_leetcode.py [--dry-run] [--ids 1,42,200]`
- `scripts/generate_topic_lists.py` — Assigns orphan problems (with content but not in any list) to topic-based curated lists. Usage: `python3 scripts/generate_topic_lists.py [--dry-run]`
- `scripts/build_database.py` — Multi-list importer (`--list {slug}`); reads `apps/web/.env.local`. Skips metadata-only problems (those without any of the 6 content fields)
- `scripts/tests/test_sync_leetcode.py` — 20 pytest tests for sync script utilities
- `scripts/ipv4-only.cjs` — Preload script forcing IPv4 for local dev on WSL2

**Content fields**: `explanation`, `solution_code`, `complexity_analysis`, `pseudocode`, `alternative_approaches`, `follow_up`. Both `sync_leetcode.py` and `build_database.py` use same list.
