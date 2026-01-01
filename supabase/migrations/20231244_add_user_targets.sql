-- Migration: Add User Targets/Objectives
-- Ticket 24: Objectifs par commercial

-- Objectifs mensuels par commercial
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_lead_target INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_closing_target INT DEFAULT 0;

-- Index pour les requêtes de performance
CREATE INDEX IF NOT EXISTS idx_users_targets ON users(monthly_lead_target, monthly_closing_target)
WHERE monthly_lead_target > 0 OR monthly_closing_target > 0;
