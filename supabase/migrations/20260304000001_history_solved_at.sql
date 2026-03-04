ALTER TABLE history
  ADD COLUMN IF NOT EXISTS solved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_history_user_solved
  ON history (user_id, solved_at)
  WHERE solved_at IS NOT NULL;
