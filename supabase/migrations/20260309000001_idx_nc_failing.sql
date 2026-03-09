-- Add partial index for efficient failing channel count queries.
-- Used by the admin dashboard to count channels with consecutive_send_failures >= 3.
-- The existing idx_nc_verified covers the healthy path (< 3); this covers the failing path.

CREATE INDEX IF NOT EXISTS idx_nc_failing
  ON notification_channels (consecutive_send_failures)
  WHERE consecutive_send_failures >= 3;
