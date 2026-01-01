-- Migration: Add AI Coaching for Managers
-- Ticket 25: L'IA genere des conseils de coaching pour les managers

-- Creer la table user_performance_profiles si elle n'existe pas
CREATE TABLE IF NOT EXISTS user_performance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Colonnes pour stocker les conseils de coaching generes par l'IA
ALTER TABLE user_performance_profiles ADD COLUMN IF NOT EXISTS ai_coaching_tips JSONB DEFAULT '[]';
ALTER TABLE user_performance_profiles ADD COLUMN IF NOT EXISTS improvement_areas JSONB DEFAULT '[]';
ALTER TABLE user_performance_profiles ADD COLUMN IF NOT EXISTS coaching_generated_at TIMESTAMPTZ;
ALTER TABLE user_performance_profiles ADD COLUMN IF NOT EXISTS coaching_strengths JSONB DEFAULT '[]';
ALTER TABLE user_performance_profiles ADD COLUMN IF NOT EXISTS coaching_quick_wins JSONB DEFAULT '[]';

-- Index pour les requetes
CREATE INDEX IF NOT EXISTS idx_user_perf_coaching ON user_performance_profiles(coaching_generated_at)
WHERE coaching_generated_at IS NOT NULL;

-- Index sur user_id pour les lookups rapides
CREATE INDEX IF NOT EXISTS idx_user_perf_user_id ON user_performance_profiles(user_id);

-- RLS policies
ALTER TABLE user_performance_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Les managers peuvent voir les profils de leur equipe
CREATE POLICY IF NOT EXISTS "Managers can view team profiles" ON user_performance_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR u.role = 'manager')
      AND u.team_id = (SELECT team_id FROM users WHERE id = user_performance_profiles.user_id)
    )
  );

-- Policy: Les managers peuvent modifier les profils de leur equipe
CREATE POLICY IF NOT EXISTS "Managers can update team profiles" ON user_performance_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR u.role = 'manager')
      AND u.team_id = (SELECT team_id FROM users WHERE id = user_performance_profiles.user_id)
    )
  );
