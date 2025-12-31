-- Migration: Add sequences system tables
-- Run this in Supabase SQL Editor

-- Table des séquences
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  stop_conditions JSONB DEFAULT '["replied", "meeting_scheduled", "do_not_contact"]',
  auto_enroll_rules JSONB,
  total_enrolled INT DEFAULT 0,
  total_completed INT DEFAULT 0,
  total_converted INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Structure d'un step dans steps :
-- {
--   "order": 1,
--   "delay_days": 0,
--   "delay_hours": 0,
--   "action_type": "call" | "email" | "sms" | "whatsapp" | "linkedin" | "task",
--   "action_config": { "template_id": "uuid" } ou { "message": "..." },
--   "conditions": { "only_if_no_response": true, "skip_weekends": true }
-- }

-- Table liaison lead <-> séquence
CREATE TABLE IF NOT EXISTS lead_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  current_step INT DEFAULT 0,
  status TEXT CHECK (status IN ('active', 'paused', 'completed', 'stopped', 'converted')) DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  next_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  stopped_reason TEXT,
  steps_completed JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, sequence_id)
);

-- Table des templates (email, SMS...)
CREATE TABLE IF NOT EXISTS sequence_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('email', 'sms', 'whatsapp', 'linkedin')) NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  available_variables JSONB DEFAULT '["first_name", "last_name", "company_name", "product_interest"]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sequences_team_id ON sequences(team_id);
CREATE INDEX IF NOT EXISTS idx_sequences_active ON sequences(active);
CREATE INDEX IF NOT EXISTS idx_lead_sequences_lead_id ON lead_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_sequences_sequence_id ON lead_sequences(sequence_id);
CREATE INDEX IF NOT EXISTS idx_lead_sequences_status ON lead_sequences(status);
CREATE INDEX IF NOT EXISTS idx_lead_sequences_next_step_at ON lead_sequences(next_step_at);
CREATE INDEX IF NOT EXISTS idx_sequence_templates_team_id ON sequence_templates(team_id);

-- Enable RLS
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sequences
CREATE POLICY "Users can view their team's sequences"
  ON sequences FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert sequences for their team"
  ON sequences FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their team's sequences"
  ON sequences FOR UPDATE
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their team's sequences"
  ON sequences FOR DELETE
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- RLS Policies for lead_sequences
CREATE POLICY "Users can view their team's lead_sequences"
  ON lead_sequences FOR SELECT
  USING (lead_id IN (
    SELECT id FROM leads WHERE team_id IN (SELECT team_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "Users can insert lead_sequences for their team"
  ON lead_sequences FOR INSERT
  WITH CHECK (lead_id IN (
    SELECT id FROM leads WHERE team_id IN (SELECT team_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "Users can update their team's lead_sequences"
  ON lead_sequences FOR UPDATE
  USING (lead_id IN (
    SELECT id FROM leads WHERE team_id IN (SELECT team_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "Users can delete their team's lead_sequences"
  ON lead_sequences FOR DELETE
  USING (lead_id IN (
    SELECT id FROM leads WHERE team_id IN (SELECT team_id FROM users WHERE id = auth.uid())
  ));

-- RLS Policies for sequence_templates
CREATE POLICY "Users can view their team's templates"
  ON sequence_templates FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert templates for their team"
  ON sequence_templates FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their team's templates"
  ON sequence_templates FOR UPDATE
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their team's templates"
  ON sequence_templates FOR DELETE
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));
