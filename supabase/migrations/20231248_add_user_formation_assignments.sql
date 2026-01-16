-- Migration: Add user formation assignments table
-- Ticket 3: Configurer quel commercial gère quels types de formation, et quel jour

-- Create user_formation_assignments table
CREATE TABLE IF NOT EXISTS user_formation_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    formation_type_id UUID NOT NULL REFERENCES formation_types(id) ON DELETE CASCADE,
    day_of_week INTEGER[] DEFAULT NULL, -- [0-6] where 0=Sunday, 1=Monday, etc. NULL means all days
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0, -- Higher priority = assigned first
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint to prevent duplicate assignments for same user/formation/days
    CONSTRAINT unique_user_formation_days UNIQUE (team_id, user_id, formation_type_id, day_of_week)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_formation_assignments_team_id ON user_formation_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_user_formation_assignments_user_id ON user_formation_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_formation_assignments_formation_type_id ON user_formation_assignments(formation_type_id);
CREATE INDEX IF NOT EXISTS idx_user_formation_assignments_active ON user_formation_assignments(is_active) WHERE is_active = true;

-- Enable RLS on user_formation_assignments
ALTER TABLE user_formation_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_formation_assignments
CREATE POLICY "Users can view assignments in their team"
    ON user_formation_assignments FOR SELECT
    USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage assignments"
    ON user_formation_assignments FOR ALL
    USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Managers can manage assignments"
    ON user_formation_assignments FOR ALL
    USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'manager'));
