-- C1: Prevent users from modifying protected columns (is_admin, line_push_allowed, last_push_date)
CREATE OR REPLACE FUNCTION restrict_user_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
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

-- C2: On history, only allow solved_at to change
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

-- C3: Revoke advance_list_positions from non-service roles
REVOKE EXECUTE ON FUNCTION advance_list_positions(jsonb) FROM PUBLIC, anon, authenticated;
