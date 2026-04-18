-- Analytics hot-path index for admin dashboard.
--
-- The `/admin/push` monitor and other aggregate analytics filter `history`
-- by `solved_at` (time-range queries like "problems solved in the last 7
-- days"). The existing `(user_id, solved_at)` index does not cover global
-- time-range scans because `user_id` is the leading column.
--
-- Partial index (WHERE solved_at IS NOT NULL) keeps the index small —
-- rows marked `skipped_at` or still unsent don't take up index pages.

CREATE INDEX IF NOT EXISTS idx_history_solved_at
  ON history (solved_at DESC)
  WHERE solved_at IS NOT NULL;
