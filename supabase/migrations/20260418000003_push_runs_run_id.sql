-- Add a generated UUID to each push_runs row so logs from a single
-- worker run can be correlated with its audit row.
--
-- `gen_random_uuid()` default means existing insert sites do not need
-- to change to migrate safely: the column populates automatically and
-- application code can start reading it at any pace. A UNIQUE index
-- enforces the correlation-id semantics and keeps equality lookups
-- on a compact single-key btree.

ALTER TABLE push_runs
  ADD COLUMN IF NOT EXISTS run_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_runs_run_id
  ON push_runs (run_id);
