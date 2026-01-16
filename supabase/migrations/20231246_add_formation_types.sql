-- Migration: Add formation types table and formation_type_id to leads
-- Ticket 1: Type de formation sur les leads

-- Create formation_types table
CREATE TABLE IF NOT EXISTS formation_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    order_position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on team_id
CREATE INDEX IF NOT EXISTS idx_formation_types_team_id ON formation_types(team_id);

-- Add formation_type_id to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS formation_type_id UUID REFERENCES formation_types(id) ON DELETE SET NULL;

-- Add index on formation_type_id for leads
CREATE INDEX IF NOT EXISTS idx_leads_formation_type_id ON leads(formation_type_id);

-- Enable RLS on formation_types
ALTER TABLE formation_types ENABLE ROW LEVEL SECURITY;

-- RLS policies for formation_types
CREATE POLICY "Users can view formation types in their team"
    ON formation_types FOR SELECT
    USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage formation types"
    ON formation_types FOR ALL
    USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Managers can manage formation types"
    ON formation_types FOR ALL
    USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'manager'));
