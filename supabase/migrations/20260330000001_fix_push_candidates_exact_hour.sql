-- Fix: revert push_hour_utc comparison from <= to = (exact hour match).
--
-- The <= operator caused all users to be selected at their local midnight:
-- at UTC 16 (midnight Asia/Taipei), last_push_date rolls over to a new day
-- AND push_hour_utc <= 16 matches hours 0-16, so everyone gets pushed at once
-- instead of at their configured hour.

CREATE OR REPLACE FUNCTION get_push_candidates()
RETURNS TABLE (
    id               UUID,
    timezone         TEXT,
    active_mode      TEXT,
    difficulty_min   INT,
    difficulty_max   INT,
    topic_filter     TEXT[],
    line_push_allowed BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, timezone, active_mode, difficulty_min, difficulty_max, topic_filter, line_push_allowed
    FROM users
    WHERE push_enabled = true
      AND onboarding_completed = true
      AND push_hour_utc = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::int
      AND (
          last_push_date IS NULL
          OR last_push_date < (NOW() AT TIME ZONE COALESCE(timezone, 'Asia/Taipei'))::DATE
      );
$$;
