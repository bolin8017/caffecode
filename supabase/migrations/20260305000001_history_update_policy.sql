-- Allow authenticated users to update only solved_at on their own history rows
CREATE POLICY "history: update own solved_at"
  ON history
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
