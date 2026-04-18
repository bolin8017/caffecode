-- Nightly cleanup of expired notification link tokens.
--
-- `notification_channels.link_token_expires_at` marks a 30-minute window
-- during which a user can verify a channel via the deep link flow.
-- After that, the token is dead weight; the row keeps `link_token` +
-- `link_token_expires_at` populated even though they can never be used.
--
-- This job nulls them out an hour after expiry (small grace window to
-- ensure the client can't race with the delete). We do NOT delete the
-- whole channel row — the user may still complete a fresh verification
-- flow, and some channels have `channel_identifier` populated already.

-- Unschedule any prior registration with the same name so re-applying
-- this migration is idempotent. cron.schedule is insert-only; without
-- this guard a re-apply would create a duplicate job.
DO $mig$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'cleanup-expired-link-tokens';
END;
$mig$;

SELECT cron.schedule(
  'cleanup-expired-link-tokens',
  '0 3 * * *',  -- daily at 03:00 UTC
  $$
    UPDATE notification_channels
    SET link_token = NULL,
        link_token_expires_at = NULL
    WHERE link_token IS NOT NULL
      AND link_token_expires_at IS NOT NULL
      AND link_token_expires_at < now() - interval '1 hour';
  $$
);
