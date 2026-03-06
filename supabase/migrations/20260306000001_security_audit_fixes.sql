-- H2: Enable RLS on push_runs (was missing — any authenticated user could read/write)
ALTER TABLE push_runs ENABLE ROW LEVEL SECURITY;

-- H3: Add INSERT policy for user_badges (badges could never be awarded)
CREATE POLICY "user_badges_insert_own" ON user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- H4: Set search_path on SECURITY DEFINER functions
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

-- H5: Fix restrict_user_update trigger to allow service_role writes
-- Without this fix, stamp_last_push_date and setLinePushAllowed silently fail
CREATE OR REPLACE FUNCTION restrict_user_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow service_role full access (worker stamp_last_push_date, admin setLinePushAllowed)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.is_admin          := OLD.is_admin;
  NEW.line_push_allowed := OLD.line_push_allowed;
  NEW.last_push_date    := OLD.last_push_date;
  RETURN NEW;
END;
$$;

-- Re-revoke advance_list_positions (CREATE OR REPLACE resets grants)
REVOKE EXECUTE ON FUNCTION advance_list_positions(jsonb) FROM PUBLIC, anon, authenticated;
