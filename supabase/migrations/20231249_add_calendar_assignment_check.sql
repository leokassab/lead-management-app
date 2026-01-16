-- Migration: Add calendar availability check for lead assignment
-- Ticket 4: Vérifier les disponibilités calendrier du commercial avant attribution

-- Add calendar check settings to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS assignment_check_calendar BOOLEAN DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS assignment_fallback_strategy TEXT
  CHECK (assignment_fallback_strategy IN ('next_available', 'round_robin', 'manual'))
  DEFAULT 'round_robin';

-- Add comment for documentation
COMMENT ON COLUMN teams.assignment_check_calendar IS 'If true, check commercial calendar availability before assigning leads';
COMMENT ON COLUMN teams.assignment_fallback_strategy IS 'Strategy when no commercial is available: next_available, round_robin, or manual';
