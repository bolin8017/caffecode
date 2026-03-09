-- Filter push candidates to only include users who have completed onboarding.
-- Previously: get_push_candidates() selected all push_enabled users regardless of
-- onboarding_completed status. New users who signed up but hadn't selected a list
-- or verified a channel were processed on every worker run unnecessarily.

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
