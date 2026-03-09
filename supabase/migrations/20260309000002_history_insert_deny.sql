-- Explicitly deny INSERT on history for all non-service_role callers.
-- The history table had RLS enabled but no INSERT policy, allowing any authenticated
-- user to directly POST fake solve records via PostgREST, manipulating badge calculations.
-- Worker inserts via service_role which bypasses RLS.

CREATE POLICY "history: deny insert"
  ON history
  FOR INSERT
  WITH CHECK (false);
