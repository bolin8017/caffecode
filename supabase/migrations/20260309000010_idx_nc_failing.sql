-- Add partial index for efficient failing channel count queries.
-- Used by the admin dashboard to count channels with consecutive_send_failures >= 3.
-- The existing idx_nc_verified covers the healthy path (< 3); this covers the failing path.
--
-- NOTE: Renamed from 20260309000001 to avoid a filename-prefix collision with
-- 20260309000001_revoke_dangerous_rpcs.sql. The CREATE INDEX is idempotent,
-- so re-application on existing databases is a no-op.

CREATE INDEX IF NOT EXISTS idx_nc_failing
  ON notification_channels (consecutive_send_failures)
  WHERE consecutive_send_failures >= 3;
