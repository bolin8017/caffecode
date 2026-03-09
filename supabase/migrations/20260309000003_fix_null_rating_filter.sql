-- Fix filter-mode problem selection to include NULL-rated problems.
-- Previously: WHERE p.rating >= p_diff_min AND p.rating <= p_diff_max
-- NULL comparisons return false in SQL, so problems without a zerotrac contest rating
-- (e.g. Two Sum, Palindrome Number) were invisible to all filter-mode users regardless
-- of their difficulty range settings. Users with default 0/3000 ("no filter") expected
-- all problems but received none of the unrated ones.

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
    WHERE (p.rating IS NULL OR (p.rating >= p_diff_min AND p.rating <= p_diff_max))
      AND (p_topic IS NULL OR p.topics && p_topic)
      AND NOT EXISTS (
          SELECT 1 FROM history h
          WHERE h.user_id = p_user_id AND h.problem_id = p.id
      );
$$;
