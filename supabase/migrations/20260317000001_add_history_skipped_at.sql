-- Add skipped_at column to history table.
-- Allows users to dismiss unsolved problems from their dashboard queue.
-- The existing restrict_history_update() trigger only locks id, user_id,
-- problem_id, sent_at — so skipped_at is already permitted for updates.

ALTER TABLE history ADD COLUMN skipped_at TIMESTAMPTZ;
