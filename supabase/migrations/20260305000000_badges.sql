-- Badge definitions
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

-- User-earned badges
CREATE TABLE user_badges (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id    INT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_read" ON badges FOR SELECT USING (true);
CREATE POLICY "user_badges_read_own" ON user_badges FOR SELECT USING (auth.uid() = user_id);

-- Seed initial 8 badges
INSERT INTO badges (slug, name, description, icon, category, requirement) VALUES
  ('first-solve',    'First Brew',       'Mark your first problem as solved',           'coffee',    'milestone', '{"type":"total_solves","threshold":1}'),
  ('ten-solves',     'Ten Down',         'Solve 10 problems',                           'book',      'milestone', '{"type":"total_solves","threshold":10}'),
  ('century',        'Century Club',     'Solve 100 problems',                          'trophy',    'milestone', '{"type":"total_solves","threshold":100}'),
  ('streak-7',       'Weekly Regular',   'Maintain a 7-day solve streak',               'fire',      'streak',   '{"type":"streak","threshold":7}'),
  ('streak-30',      'Monthly Grind',    'Maintain a 30-day solve streak',              'lightning', 'streak',   '{"type":"streak","threshold":30}'),
  ('dp-master',      'DP Master',        'Reach Level 3 in Dynamic Programming',        'puzzle',    'skill',    '{"type":"topic_level","topic":"dynamic-programming","threshold":3}'),
  ('graph-explorer', 'Graph Explorer',   'Reach Level 3 in Graph',                      'map',       'skill',    '{"type":"topic_level","topic":"graph","threshold":3}'),
  ('garden-owner',   'Garden Owner',     'Grow trees in 10 different topics',           'sprout',    'variety',  '{"type":"topic_count","threshold":10}');
