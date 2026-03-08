-- ================================================================
-- CaffeCode Production Schema
-- UUID-based Supabase Auth model (web platform + worker)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. problems — Central Problem Registry
-- ----------------------------------------------------------------
CREATE TABLE problems (
    id          SERIAL PRIMARY KEY,
    leetcode_id INT    UNIQUE NOT NULL,
    title       TEXT   NOT NULL,
    slug        TEXT   UNIQUE NOT NULL,
    difficulty  TEXT   NOT NULL,          -- Easy / Medium / Hard
    rating      INT,                      -- Contest rating (zerotrac), nullable
    topics      TEXT[] NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_problems_rating ON problems (rating);

-- ----------------------------------------------------------------
-- 2. curated_lists — Registry of Curated Problem Lists
-- ----------------------------------------------------------------
CREATE TABLE curated_lists (
    id            SERIAL PRIMARY KEY,
    slug          TEXT UNIQUE NOT NULL,   -- e.g. blind75, neetcode150
    name          TEXT NOT NULL,
    description   TEXT,
    problem_count INT  NOT NULL DEFAULT 0,
    type          TEXT NOT NULL DEFAULT 'classic'
        CHECK (type IN ('classic','official','company','topic','algorithm','difficulty','challenge'))
);

-- ----------------------------------------------------------------
-- 3. list_problems — Many-to-Many: list <-> problems (with ordering)
-- ----------------------------------------------------------------
CREATE TABLE list_problems (
    id              SERIAL PRIMARY KEY,
    list_id         INT NOT NULL REFERENCES curated_lists(id) ON DELETE CASCADE,
    problem_id      INT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    sequence_number INT NOT NULL,
    UNIQUE (list_id, problem_id),
    UNIQUE (list_id, sequence_number)
);
CREATE INDEX idx_list_problems_list_seq ON list_problems (list_id, sequence_number);

-- ----------------------------------------------------------------
-- 4. problem_content — AI-Generated Explanatory Content
-- ----------------------------------------------------------------
CREATE TABLE problem_content (
    id                     SERIAL PRIMARY KEY,
    problem_id             INT UNIQUE NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    solution_code          TEXT NOT NULL,          -- Verified C++ solution
    explanation            TEXT NOT NULL,          -- Problem description + approach
    complexity_analysis    TEXT NOT NULL,          -- Time/space complexity
    pseudocode             TEXT,
    alternative_approaches TEXT,
    follow_up              TEXT,
    avg_score              REAL    NOT NULL DEFAULT 0,
    score_count            INT     NOT NULL DEFAULT 0,
    needs_regeneration     BOOLEAN NOT NULL DEFAULT false,
    generated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_problem_content_needs_regen ON problem_content (needs_regeneration)
    WHERE needs_regeneration = true;
CREATE INDEX idx_problem_content_avg_score   ON problem_content (avg_score);

-- ----------------------------------------------------------------
-- 5. users — Supabase Auth profile extension
-- ----------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT,
    display_name    TEXT,
    avatar_url      TEXT,
    is_admin        BOOLEAN NOT NULL DEFAULT false,
    timezone        TEXT NOT NULL DEFAULT 'Asia/Taipei',
    line_push_allowed BOOLEAN NOT NULL DEFAULT false,
    active_mode     TEXT NOT NULL DEFAULT 'list',
    difficulty_min  INT NOT NULL DEFAULT 0,
    difficulty_max  INT NOT NULL DEFAULT 3000,
    topic_filter    TEXT[],
    push_enabled    BOOLEAN NOT NULL DEFAULT true,
    push_hour       INT NOT NULL DEFAULT 9,
    last_push_date  DATE,           -- local calendar date of last delivery (per user timezone); at-most-once guard
    push_hour_utc   INT NOT NULL DEFAULT 1,  -- push_hour converted to UTC at write time; worker scans by this
    CONSTRAINT push_hour_utc_range CHECK (push_hour_utc >= 0 AND push_hour_utc <= 23),
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT push_hour_range CHECK (push_hour >= 0 AND push_hour <= 23),
    CONSTRAINT chk_active_mode CHECK (active_mode IN ('list', 'filter'))
);
CREATE INDEX idx_users_push ON users(push_enabled, push_hour_utc);
CREATE INDEX idx_users_last_push_date ON users(last_push_date);

-- ----------------------------------------------------------------
-- 6. notification_channels — push delivery channels
-- ----------------------------------------------------------------
CREATE TABLE notification_channels (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type              TEXT NOT NULL
        CONSTRAINT chk_channel_type CHECK (channel_type IN ('telegram', 'line', 'email')),
    channel_identifier        TEXT,           -- telegram chat_id / line_uid / email (null until verified)
    display_label             TEXT,
    is_verified               BOOLEAN NOT NULL DEFAULT false,
    link_token                UUID UNIQUE,    -- one-time deep-link token for Telegram verification
    consecutive_send_failures INT NOT NULL DEFAULT 0,
    link_token_expires_at     TIMESTAMPTZ,        -- token expiry (30 min after creation)
    connected_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (channel_type, channel_identifier),
    UNIQUE (user_id, channel_type)
);
CREATE INDEX idx_nc_user_id  ON notification_channels(user_id);
CREATE INDEX idx_nc_verified ON notification_channels(is_verified, user_id)
    WHERE consecutive_send_failures < 3;

-- ----------------------------------------------------------------
-- 7. user_list_progress — per-user list tracking (multi-list)
-- ----------------------------------------------------------------
CREATE TABLE user_list_progress (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_id          INT NOT NULL REFERENCES curated_lists(id) ON DELETE CASCADE,
    current_position INT NOT NULL DEFAULT 0,
    is_active        BOOLEAN NOT NULL DEFAULT false,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, list_id)
);
CREATE INDEX idx_ulp_user_id ON user_list_progress(user_id);
-- Enforce exactly one active list per user
CREATE UNIQUE INDEX one_active_list_per_user
    ON user_list_progress (user_id) WHERE is_active = true;

-- ----------------------------------------------------------------
-- 8. history — per-user problem history
-- ----------------------------------------------------------------
CREATE TABLE history (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id INT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    solved_at  TIMESTAMPTZ,          -- NULL = not yet marked solved; set by user action
    UNIQUE (user_id, problem_id)
);
CREATE INDEX idx_history_user ON history(user_id);
CREATE INDEX idx_history_user_sent_at ON history(user_id, sent_at DESC);
CREATE INDEX idx_history_user_solved ON history(user_id, solved_at)
  WHERE solved_at IS NOT NULL;

-- ----------------------------------------------------------------
-- 9. push_runs — per-worker-run aggregates for admin monitoring
-- ----------------------------------------------------------------
CREATE TABLE push_runs (
  id           SERIAL PRIMARY KEY,
  ran_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  candidates   INT NOT NULL DEFAULT 0,
  succeeded    INT NOT NULL DEFAULT 0,
  failed       INT NOT NULL DEFAULT 0,
  error_msg    TEXT,        -- NULL = completed normally
  duration_ms  INT
);

-- ----------------------------------------------------------------
-- 10. feedback — difficulty + content quality feedback
-- ----------------------------------------------------------------
CREATE TABLE feedback (
    id            SERIAL PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id    INT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    difficulty    TEXT
        CONSTRAINT chk_difficulty CHECK (difficulty IN ('too_easy', 'just_right', 'too_hard')),
    content_score INT CHECK (content_score >= 1 AND content_score <= 5),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, problem_id)
);
CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_problem ON feedback(problem_id) WHERE content_score IS NOT NULL;

-- ----------------------------------------------------------------
-- 11. badges — Badge definitions
-- ----------------------------------------------------------------
CREATE TABLE badges (
    id          SERIAL PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    icon        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'milestone'
        CHECK (category IN ('milestone', 'streak', 'skill', 'variety')),
    requirement JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- 12. user_badges — User-earned badges
-- ----------------------------------------------------------------
CREATE TABLE user_badges (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id    INT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- ================================================================
-- Utility Functions
-- ================================================================

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-create profile on OAuth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- updated_at triggers
-- ================================================================
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_nc_updated_at
    BEFORE UPDATE ON notification_channels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ulp_updated_at
    BEFORE UPDATE ON user_list_progress FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================

ALTER TABLE problems           ENABLE ROW LEVEL SECURITY;
ALTER TABLE curated_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_problems      ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_content    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_list_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE history            ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback           ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges        ENABLE ROW LEVEL SECURITY;

-- Public read on content tables (for public problem/list pages)
CREATE POLICY "problems: anyone read"      ON problems        FOR SELECT USING (true);
CREATE POLICY "lists: anyone read"         ON curated_lists   FOR SELECT USING (true);
CREATE POLICY "list_problems: anyone read" ON list_problems   FOR SELECT USING (true);
CREATE POLICY "content: anyone read"       ON problem_content FOR SELECT USING (true);

-- users
CREATE POLICY "users: read own"   ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users: update own" ON users FOR UPDATE USING (auth.uid() = id);

-- notification_channels
CREATE POLICY "channels: self only" ON notification_channels
    FOR ALL USING (auth.uid() = user_id);

-- user_list_progress
CREATE POLICY "progress: self only" ON user_list_progress
    FOR ALL USING (auth.uid() = user_id);

-- history (writes via service_role from worker)
CREATE POLICY "history: read own" ON history
    FOR SELECT USING (auth.uid() = user_id);

-- feedback
CREATE POLICY "feedback: self only" ON feedback
    FOR ALL USING (auth.uid() = user_id);

-- badges
CREATE POLICY "badges_read" ON badges FOR SELECT USING (true);
CREATE POLICY "user_badges_read_own" ON user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_badges_insert_own" ON user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- Security Triggers
-- ================================================================

-- Prevent users from modifying protected columns (service_role bypassed)
CREATE OR REPLACE FUNCTION restrict_user_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.is_admin          := OLD.is_admin;
  NEW.line_push_allowed := OLD.line_push_allowed;
  NEW.last_push_date    := OLD.last_push_date;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_user_update
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION restrict_user_update();

-- Prevent users from modifying immutable history columns (only solved_at may change)
CREATE OR REPLACE FUNCTION restrict_history_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id    IS DISTINCT FROM OLD.user_id    OR
     NEW.problem_id IS DISTINCT FROM OLD.problem_id OR
     NEW.sent_at    IS DISTINCT FROM OLD.sent_at    OR
     NEW.id         IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only solved_at may be updated on history rows';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_history_update
  BEFORE UPDATE ON history
  FOR EACH ROW
  EXECUTE FUNCTION restrict_history_update();

-- Revoke advance_list_positions from non-service roles
REVOKE EXECUTE ON FUNCTION advance_list_positions(jsonb) FROM PUBLIC, anon, authenticated;

-- ================================================================
-- DB Functions: daily push
-- ================================================================

-- get_push_candidates: returns users eligible for a push in the current UTC hour.
-- push_hour_utc is pre-computed at write time (settings save) so this is a plain
-- integer index scan — no per-row timezone arithmetic at query time.
-- last_push_date is still compared in the user's own timezone (one comparison per row
-- is fine; it's only the hourly fan-out scan that needed the index).
CREATE OR REPLACE FUNCTION get_push_candidates()
RETURNS TABLE(
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
      AND push_hour_utc = EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::int
      AND (
          last_push_date IS NULL
          OR last_push_date < (NOW() AT TIME ZONE COALESCE(timezone, 'Asia/Taipei'))::DATE
      );
$$;

-- stamp_last_push_date: marks a batch of users as "delivered today" (at-most-once).
-- Called before dispatching jobs so that a worker crash/retry won't re-deliver.
CREATE OR REPLACE FUNCTION stamp_last_push_date(p_user_ids UUID[])
RETURNS void
LANGUAGE sql
AS $$
    UPDATE users
    SET last_push_date = (NOW() AT TIME ZONE COALESCE(timezone, 'Asia/Taipei'))::DATE
    WHERE id = ANY(p_user_ids);
$$;

-- advance_list_positions: batch-update user_list_progress positions in a single query.
-- Accepts a jsonb array of {user_id, list_id, sequence_number} objects.
-- Replaces N individual UPDATE queries with one FROM join.
CREATE OR REPLACE FUNCTION advance_list_positions(p_updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_list_progress ulp
  SET current_position = u.sequence_number,
      updated_at = now()
  FROM jsonb_to_recordset(p_updates) AS u(user_id uuid, list_id integer, sequence_number integer)
  WHERE ulp.user_id = u.user_id
    AND ulp.list_id = u.list_id;
END;
$$;

-- get_topic_proficiency: per-topic solve stats for the coffee garden.
-- Uses unnest(topics) to fan out multi-topic problems, then aggregates.
CREATE OR REPLACE FUNCTION get_topic_proficiency(p_user_id UUID)
RETURNS TABLE (topic TEXT, solved_count BIGINT, total_received BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT
    t.topic,
    COUNT(*) FILTER (WHERE h.solved_at IS NOT NULL) AS solved_count,
    COUNT(*)                                          AS total_received
  FROM history h
  JOIN problems p ON p.id = h.problem_id
  CROSS JOIN unnest(p.topics) AS t(topic)
  WHERE h.user_id = p_user_id
  GROUP BY t.topic
  ORDER BY solved_count DESC, total_received DESC
$$;

-- get_unsent_problem_ids_for_user: filter-mode problem selection.
-- Returns IDs of problems matching difficulty/topic filters that the user hasn't received.
CREATE OR REPLACE FUNCTION get_unsent_problem_ids_for_user(
    p_user_id     UUID,
    p_diff_min    INT,
    p_diff_max    INT,
    p_topic       TEXT[] DEFAULT NULL
)
RETURNS TABLE(problem_id INT)
LANGUAGE sql
STABLE
AS $$
    SELECT p.id
    FROM problems p
    INNER JOIN problem_content pc ON pc.problem_id = p.id
    WHERE p.rating >= p_diff_min
      AND p.rating <= p_diff_max
      AND (p_topic IS NULL OR p.topics && p_topic)
      AND NOT EXISTS (
          SELECT 1 FROM history h
          WHERE h.user_id = p_user_id AND h.problem_id = p.id
      );
$$;

-- increment_channel_failures: atomic single-query increment.
-- Replaces the 2-round-trip SELECT+UPDATE pattern in the worker.
CREATE OR REPLACE FUNCTION increment_channel_failures(p_channel_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE notification_channels
  SET consecutive_send_failures = consecutive_send_failures + 1
  WHERE id = p_channel_id;
$$;

-- update_content_scores: auto-update problem_content.avg_score + score_count
-- when feedback.content_score changes. Eliminates app-level re-aggregation.
CREATE OR REPLACE FUNCTION update_content_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE problem_content SET
    avg_score = COALESCE(
      (SELECT AVG(content_score)::real FROM feedback
       WHERE problem_id = NEW.problem_id AND content_score IS NOT NULL), 0),
    score_count = (SELECT COUNT(*)::int FROM feedback
       WHERE problem_id = NEW.problem_id AND content_score IS NOT NULL)
  WHERE problem_id = NEW.problem_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feedback_update_scores
  AFTER INSERT OR UPDATE OF content_score ON feedback
  FOR EACH ROW
  WHEN (NEW.content_score IS NOT NULL)
  EXECUTE FUNCTION update_content_scores();
