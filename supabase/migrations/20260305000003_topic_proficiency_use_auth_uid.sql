-- L5: Add auth.uid() check for defense-in-depth
-- RLS already scopes history reads, but this makes the function self-documenting
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
    AND h.user_id = auth.uid()
  GROUP BY t.topic
  ORDER BY solved_count DESC, total_received DESC
$$;
