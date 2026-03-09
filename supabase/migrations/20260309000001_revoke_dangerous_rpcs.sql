-- Revoke EXECUTE from authenticated and anon roles for all privileged push pipeline functions.
-- These functions must only be callable by the worker (service_role), which bypasses this restriction.
-- Previously any logged-in user could call these to: silence other users' notifications,
-- stamp arbitrary users as "delivered today", or enumerate all push-enabled users.

REVOKE EXECUTE ON FUNCTION get_push_candidates()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION stamp_last_push_date(UUID[])
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION increment_channel_failures(UUID)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION get_unsent_problem_ids_for_user(UUID, INT, INT, TEXT[])
  FROM PUBLIC, anon, authenticated;
