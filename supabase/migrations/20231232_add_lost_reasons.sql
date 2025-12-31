-- Migration: Add lost_reasons table and leads columns for lost tracking
-- Run this in Supabase SQL Editor

-- Table des raisons prédéfinies par équipe
CREATE TABLE IF NOT EXISTS lost_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  order_position INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries by team
CREATE INDEX IF NOT EXISTS idx_lost_reasons_team_id ON lost_reasons(team_id);

-- Colonnes sur leads pour tracker la raison de perte
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason_details TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE lost_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lost_reasons
CREATE POLICY "Users can view their team's lost reasons"
  ON lost_reasons FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins and managers can manage lost reasons"
  ON lost_reasons FOR ALL
  USING (team_id IN (
    SELECT team_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));

-- Insert default lost reasons for existing teams
-- This will add default reasons for each team that doesn't have any yet
INSERT INTO lost_reasons (team_id, name, order_position)
SELECT
  t.id as team_id,
  reason.name,
  reason.order_position
FROM teams t
CROSS JOIN (
  VALUES
    ('Pas de budget', 1),
    ('Pas le bon timing', 2),
    ('Concurrent choisi', 3),
    ('Pas de réponse (NRP)', 4),
    ('Mauvais numéro/email', 5),
    ('Pas intéressé', 6),
    ('Doublon', 7),
    ('Hors cible', 8),
    ('Autre', 9)
) AS reason(name, order_position)
WHERE NOT EXISTS (
  SELECT 1 FROM lost_reasons lr WHERE lr.team_id = t.id
);
